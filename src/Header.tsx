import type { Language } from "./types";
import { translations } from "./translations";

function Header({ lang, title }: { lang: Language; title: string }) {
  return (
    <header
      style={{
        padding: "1rem",
        borderBottom: "2px solid #e6007e",
        fontWeight: "bold",
        textTransform: "uppercase",
      }}
    >
      {translations[lang][title as keyof typeof translations.es]}
    </header>
  );
}

export default Header;
