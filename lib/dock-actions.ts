"use server";
import { redirect } from "next/navigation";
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

async function requireTeam() {
  if (!await dockTeamMember()) throw new Error("チームのログインが必要です。");
}
function field(f:FormData,k:string) {return String(f.get(k)||"").trim();}
export async function saveTarget(f:FormData) {
  await requireTeam();
  const month=field(f,"month"), kind=field(f,"kind"), amount=field(f,"amount");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!["one_off","recurring"].includes(kind)||!/^\d{1,14}$/.test(amount)) throw new Error("月・区分・金額を確認してください。");
  const {error}=await db.from("dock_monthly_targets").upsert({month:month+"-01",kind,amount:Number(amount)},{onConflict:"month,kind"});
  if(error) throw new Error("目標を保存できませんでした。");
  revalidatePath("/","layout");
}
export async function registerProject(f:FormData){
  await requireTeam();
  const title=field(f,"title"),customer=field(f,"customer"),phase=field(f,"phase");
  if(!title||!["production","maintenance"].includes(phase)) throw new Error("案件名と状態を確認してください。");
  const {data,error}=await db.from("tm_projects").insert({title,dock_customer_id:customer,phase,category:"system",workspace_id:"00000000-0000-4000-8000-000000000005"}).select("id").single();
  if(error) throw new Error("案件を保存できませんでした。");
  revalidatePath("/","layout");
  redirect("/projects/"+data.id);
}

import { getProject } from "./data";
import { WITH_DOCK_ID } from "./meeting-inbox";

async function selectedProject(f:FormData) {
  await requireTeam();
  const project = await getProject(field(f,"project"));
  if (!project || project.workspace_id !== WITH_DOCK_ID) throw new Error("案件を選択してください。");
  return project;
}
export async function assignCustomer(f:FormData) {
  const p=await selectedProject(f);
  const {error}=await db.from("tm_projects").update({dock_customer_id:field(f,"customer")}).eq("workspace_id",WITH_DOCK_ID).eq("id",p.id);
  if(error) throw new Error("顧客を設定できませんでした。");
  revalidatePath("/","layout");
}
export async function addContract(f:FormData) {
  const p=await selectedProject(f);
  const {error}=await db.from("dock_contracts").upsert({id:field(f,"request"),project_id:p.id,legal_name:field(f,"legal_name"),kind:field(f,"kind"),scope:field(f,"scope"),free_support_terms:field(f,"free_support_terms"),starts_on:field(f,"starts_on")||null,ends_on:field(f,"ends_on")||null},{onConflict:"id",ignoreDuplicates:true});
  if(error) throw new Error("契約を保存できませんでした。");
  revalidatePath("/projects/"+p.id);
}
export async function addPayment(f:FormData) {
  const p=await selectedProject(f);
  const contract=field(f,"contract");
  const check=await db.from("dock_contracts").select("id").eq("id",contract).eq("project_id",p.id).maybeSingle();
  if(!check.data) throw new Error("この案件の契約を選択してください。");
  const {error}=await db.from("dock_payments").upsert({id:field(f,"request"),contract_id:contract,label:field(f,"label"),certainty:field(f,"certainty"),amount:field(f,"amount"),due_on:field(f,"due_on")},{onConflict:"id",ignoreDuplicates:true});
  if(error) throw new Error("入金予定を保存できませんでした。");
  revalidatePath("/","layout");
}
export async function receivePayment(f:FormData) {
  await requireTeam();
  const {error}=await db.from("dock_payments").update({received_amount:field(f,"received_amount"),received_on:field(f,"received_on")}).eq("id",field(f,"payment")).is("received_on",null);
  if(error) throw new Error("入金を記録できませんでした。");
  revalidatePath("/","layout");
}

export async function adoptImprovement(f:FormData) {
  const project=await selectedProject(f), owner=field(f,"owner"), id=field(f,"improvement");
  const [proposal,member]=await Promise.all([db.from("dock_improvements").select("title,detail,task_id").eq("id",id).single(),db.from("tm_workspace_members").select("member_id").eq("workspace_id",WITH_DOCK_ID).eq("member_id",owner).maybeSingle()]);
  if(!proposal.data||!member.data) throw new Error("改善案と担当者を確認してください。");
  if(!proposal.data.task_id){
    const task=await db.from("tm_tasks").upsert({id,workspace_id:WITH_DOCK_ID,project_id:project.id,title:proposal.data.title,detail:proposal.data.detail,category:project.category,owner_id:owner,due_date:field(f,"due")},{onConflict:"id",ignoreDuplicates:true});
    if(task.error) throw new Error("タスクを作成できませんでした。");
    const linked=await db.from("dock_improvements").update({task_id:id}).eq("id",id).is("task_id",null);
    if(linked.error) throw new Error("タスクを作成しました。再試行すると紐付けを完了します。");
  }
  revalidatePath("/","layout");
}
