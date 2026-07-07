// 루트 레이아웃 — Next 15는 루트 레이아웃 하나를 요구하지만, <html>/<body>는
// [locale]/layout.tsx가 소유한다(로케일별 lang/dir 설정 위해). 여기선 children 통과만.
// globals.css는 [locale] 레이아웃에서 import.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
