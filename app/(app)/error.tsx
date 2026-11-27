"use client";

export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <section className="card space-y-3 p-5" role="alert">
      <h2 className="font-semibold">画面を表示できませんでした</h2>
      <p>ページを再読み込みして、データの表示や保存結果を確認してください。</p>
      <button className="rounded bg-brand px-3 py-2 font-semibold text-white" onClick={retry}>再読み込み</button>
    </section>
  );
}
