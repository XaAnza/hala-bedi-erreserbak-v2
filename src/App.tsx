import { useState } from "react";
import { translations } from "./translations";
import type { Language } from "./types";
import Layout from "./Layout";
import Header from "./Header";

function App() {
  const [lang, setLang] = useState<Language | null>(null);
const [view, setView] = useState<"home" | "calendar">("home");


  if (!lang) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "black",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1 style={{ color: "#e6007e" }}>
          {translations.es.select_language}
        </h1>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={() => setLang("es")}>CASTELLANO</button>
          <button onClick={() => setLang("eu")}>EUSKERA</button>
        </div>
      </div>
    );
  }
if (view === "calendar") {
  return (
    <Layout>
      <Header lang={lang} title="calendar" />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
        }}
      >
        📅 Calendario
      </div>
    </Layout>
  );
}

  return (
  <Layout>
    <Header lang={lang} title="home" />
    <div
  style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5rem",
  }}
>
  <h1 style={{ color: "#e6007e" }}>
    {translations[lang].home}
  </h1>

  <button
  onClick={() => setView("calendar")}
  style={{
    padding: "1rem 2rem",
    background: "#111",
    color: "white",
    border: "2px solid #333",
    cursor: "pointer",
  }}
>
  {translations[lang].calendar}
</button>


  <button
    style={{
      padding: "1rem 2rem",
      background: "#111",
      color: "white",
      border: "2px solid #333",
      cursor: "pointer",
    }}
  >
    {translations[lang].my_reservations}
  </button>
</div>

  </Layout>
);

}

export default App;
