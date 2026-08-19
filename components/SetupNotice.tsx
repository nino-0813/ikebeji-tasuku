export function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <div className="card p-6">
        <h1 className="text-lg font-bold">あと1ステップで使えます</h1>
        <p className="mt-2 text-sm text-ink-soft">
          プロジェクト直下の <code className="rounded bg-stone-100 px-1">.env.local</code>{" "}
          に接続情報を書いてから、開発サーバーを立ち上げ直してください。
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs leading-relaxed text-stone-100">
          {`NEXT_PUBLIC_SUPABASE_URL=https://hgsnmzudqvgznvagtapu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=（Supabase管理画面の service_role キー）
APP_PASSWORD=（3人で共有する合言葉）`}
        </pre>
        <p className="mt-4 text-xs text-ink-mute">
          service_role キーは Supabase の
          <span className="font-medium"> Project Settings → API Keys </span>
          にあります。ブラウザには出ないサーバー専用のキーなので、外部に共有しないでください。
        </p>
      </div>
    </main>
  );
}
