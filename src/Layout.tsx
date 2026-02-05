import { ReactNode } from "react";

function Layout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "black",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

export default Layout;
