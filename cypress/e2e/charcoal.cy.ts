import { chooseFileMenuEntry, runCode } from "./shared";

const rgb = (text: string): number[] => (text.match(/[0-9.]+/g) ?? []).map(Number);
const luminance = (color: number[]): number =>
  color.slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number[], b: number[]): number => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
function requireRoot(win: Window): void {
  if (win.getComputedStyle(win.document.body).backgroundColor !== "rgb(33, 33, 33)") {
    throw new Error("non-charcoal application root");
  }
}
function surface(selector: string, background: string): void {
  cy.get(selector).first().should("have.css", "background-color", background);
}
function aa(selector: string): void {
  cy.get(selector).first().then(($element) => {
    const style = getComputedStyle($element[0]);
    expect(contrast(rgb(style.color), rgb(style.backgroundColor)), selector + " AA").gte(4.5);
  });
}

for (const scheme of ["light", "dark"]) {
  for (const width of [390, 1200]) {
    describe("charcoal " + scheme + " " + width, () => {
      it("retains actual file, editor, menu, input, execution and error behavior", () => {
        cy.viewport(width, 844);
        cy.then(() => Cypress.automation("remote:debugger:protocol", {
          command: "Emulation.setEmulatedMedia",
          params: { features: [{ name: "prefers-color-scheme", value: scheme }] },
        }));
        cy.visit("/");
        cy.window().then((win) => {
          expect(win.matchMedia("(prefers-color-scheme: dark)").matches).eq(scheme === "dark");
          requireRoot(win);
        });
        surface(".MenuBar", "rgb(47, 47, 47)");
        cy.screenshot("charcoal-" + scheme + "-" + width + "-startup");
        cy.get(".editor .busy-overlay", { timeout: 120000 }).should("not.be.visible");
        surface(".ace_editor", "rgb(33, 33, 33)");
        aa(".ace_editor");

        cy.get(".MenuBar .nav-link").contains("File").click();
        surface(".dropdown-menu", "rgb(47, 47, 47)");
        cy.screenshot("charcoal-" + scheme + "-" + width + "-menu");
        cy.get(".dropdown-item").contains("New").click();
        surface(".modal-content", "rgb(47, 47, 47)");
        surface(".modal-body input", "rgb(56, 56, 56)");
        aa(".modal-content");
        aa(".modal-body input");
        const filename = "charcoal-" + scheme + "-" + width;
        cy.get(".modal-body input").focus().type(filename);
        cy.get(".modal-body input").should("have.css", "caret-color", "rgb(244, 244, 244)");
        cy.screenshot("charcoal-" + scheme + "-" + width + "-input");
        cy.get("button").contains("Create").click();
        cy.get("div.modal").should("not.exist");
        cy.get(".editor .busy-overlay").should("not.be.visible");
        const code = "# Unicode: λ ğ ✓\nprint('charcoal ✓')\n";
        cy.window().then((win) => win["PYGGB_CYPRESS"].ACE_EDITOR.setValue(code));
        runCode();
        cy.get(".stdout-inner", { timeout: 30000 }).should("contain.text", "charcoal ✓");
        surface(".stdout-outer", "rgb(47, 47, 47)");
        aa(".stdout-outer");
        chooseFileMenuEntry("Save now");
        cy.get(".backing-state .spinner-border").should("not.be.visible");
        cy.reload();
        cy.get(".editor .busy-overlay", { timeout: 120000 }).should("not.be.visible");
        cy.window().then((win) => {
          requireRoot(win);
          expect(win["PYGGB_CYPRESS"].ACE_EDITOR.getValue()).eq(code);
          const style = win.document.createElement("style");
          style.textContent = "body { background: #FFFFFF !important; }";
          win.document.head.append(style);
          expect(win.getComputedStyle(win.document.body).backgroundColor).eq("rgb(255, 255, 255)");
          expect(() => requireRoot(win)).to.throw("non-charcoal application root");
          style.remove();
          requireRoot(win);
        });
        cy.screenshot("charcoal-" + scheme + "-" + width + "-reopened");
        cy.window().then((win) => win["PYGGB_CYPRESS"].ACE_EDITOR.setValue("1 / 0\n"));
        runCode();
        cy.get(".ErrorReport .message").should("contain.text", "zero");
        surface(".ErrorList", "rgb(47, 47, 47)");
        surface(".ErrorReport", "rgb(47, 47, 47)");
        aa(".ErrorReport");
        cy.screenshot("charcoal-" + scheme + "-" + width + "-error");
      });
    });
  }
}
