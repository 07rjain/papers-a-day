const themeBoot = `(function(){try{var k="pad-theme";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBoot }} />;
}
