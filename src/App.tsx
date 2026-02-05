import { useState } from "react";
import { translations } from "./translations";
import type { Language } from "./types";

function App() {
  const [lang, setLang] = useState<Language | null>(null);

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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "black",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>{translations[lang].home}</h1>
    </div>
  );
}

export default App;
