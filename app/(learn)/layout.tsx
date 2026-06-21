export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/css/bootstrap.css" />
      <link rel="stylesheet" href="/css/template-main.css" />
      <link rel="stylesheet" href="/font/fonts.css" />
      <link rel="stylesheet" href="/icons/flat/flaticon_upskill.css" />
      <link rel="stylesheet" href="/icons/icomoon/style.css" />
      {children}
    </>
  );
}
