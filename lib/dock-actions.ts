"use server";
import { revalidatePath } from "next/cache";
import { dockTeamMember } from "./dock-team";
import { db } from "./supabase";

export async function reviewProposal(form:FormData) {
  const actor=await dockTeamMember();
  if (!actor) throw new Error("with dockへログインしてください。");
  const edit=Object.fromEntries(["title","project","customer","name","owner","due"].map(k=>[k,String(form.get(k)||"").trim()]));
  const {error}=await db.rpc("dock_review",{pid:form.get("id"),expected_version:Number(form.get("version")),
    decision:form.get("decision"),actor_id:actor,edit});
  if(error) throw new Error("保存できませんでした。候補の状態と、登録先・担当者・期日を確認してください。");
  revalidatePath("/","layout");
}

export async function addCustomer(form:FormData) {
  if (!await dockTeamMember()) throw new Error("チームのログインが必要です。");
  const entry=Object.fromEntries(["name","summary","next_action","stage"].map(k=>[k,String(form.get(k)||"").trim()]));
  if(!entry.name || !["lead","negotiation","active"].includes(entry.stage)) throw new Error("顧客名・状況を確認してください。");
  const {error}=await db.from("dock_customers").insert(entry);
  if(error) throw new Error("顧客を保存できませんでした。");
  revalidatePath("/customers");
}
