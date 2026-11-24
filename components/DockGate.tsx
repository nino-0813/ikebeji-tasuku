import Link from "next/link";
export function DockGate() {
  return <div className="card space-y-3 p-5"><h2 className="font-bold">with dock チームログイン</h2><p>チームの合言葉でログインすると、顧客情報の閲覧と提案の承認ができます。</p><Link className="text-brand underline" href="/login?team=withdock">ログインへ</Link></div>;
}
