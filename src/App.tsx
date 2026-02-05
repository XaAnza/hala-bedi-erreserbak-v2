import { useState } from "react";
import type { Language } from "./types";
import { translations } from "./translations";
import Layout from "./Layout";
import Header from "./Header";

type View = "home" | "calendar" | "reservations";

function App() {
  const [lang, setLang] = useState<Language | null>(null);
  const [view, setView] = useState<View>("home");

  /* ─────────────── IDIOMA ─────────────── */
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

  /* ─────────────── CALENDARIO ─────────────── */
  if (view === "calendar") {
    return (
      <Layout>
        <Header lang={lang} title="calendar" />
        <button
          onClick={() => setView("home")}
          style={{
            margin: "1rem",
            background: "none",
            border: "none",
            color: "#e6007e",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ← {translations[lang].go_back}
        </button>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
          }}
        >
          📅 Calendario (base)
        </div>
      </Layout>
    );
  }

  /* ─────────────── MIS RESERVAS ─────────────── */
  if (view === "reservations") {
    return (
      <Layout>
        <Header lang={lang} title="my_reservations" />
        <button
          onClick={() => setView("home")}
          style={{
            margin: "1rem",
            background: "none",
            border: "none",
            color: "#e6007e",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ← {translations[lang].go_back}
        </button>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          📄 Mis reservas (pendiente)
        </div>
      </Layout>
    );
  }

  /* ─────────────── HOME ─────────────── */
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
          onClick={() => setView("reservations")}
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
