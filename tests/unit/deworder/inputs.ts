// Inputs from the ported unit tests (prodtools' tests/deworder/deworder.test.html),
// shared with the differential test so both engines see exactly these.
import type { DeworderConfig } from "@/tools/deworder/engine/deworder";

export const cxspClasses = `
  <p class="NoKTextCxSpFirst">A</p>
  <p class="NoKTextCxSpMiddle">B</p>
  <p class="NoKTextCxSpLast">C</p>
`;

export const commentElements = `
  <p class="NoKText">Keep</p>
  <p class="MsoCommentText">Drop by class</p>
  <p class="NoKIngress" style="mso-element:comment">Drop by style</p>
`;

export const stripAndKeep = `
  <p class="NoKText">Keep text</p>
  <p class="NoKRubrik1">Drop heading</p>
  <span class="NoKBetoningKursiv">Keep class</span>
`;

export const cxspSingle = `<p class="NoKTextCxSpFirst">A</p>`;

export const linkWithText = `<p class="NoKText">Go to <a href="https://example.com/page">example</a>.</p>`;

export const linkSelfLabelled = `<p class="NoKText"><a href="https://example.com">https://example.com</a></p>`;

export const unsafe = `
  <p class="NoKText" style="mso-style-name:normal" onclick="alert(1)">Safe</p>
  <script>alert(1)</script>
  <form><input value="x"></form>
  <img src="x" onerror="alert(1)">
`;

export const listRuns = `
  <p class="NoKPunktlista">A</p>
  <p class="NoKPunktlista">B</p>
  <p class="NoKText">Break</p>
  <p class="NoKPunktlista">C</p>
`;

export const olThenUl = `
  <p class="NumList">First</p>
  <p class="NumList">Second</p>
  <p class="NoKPunktlista">Bullet</p>
`;

export const olUlOl = `
  <p class="NumList">A</p>
  <p class="NoKPunktlista">B</p>
  <p class="NumList">C</p>
`;

export const wordListMarkers = `
  <p class=NoKPunktlista style='mso-list:l21 level1 lfo42'><![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span><![endif]><span style='mso-fareast-font-family:Arial'>Numbered one</span></p>
  <p class=NoKPunktlista style='mso-list:l21 level1 lfo42'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp;</span></span><![endif]><span>Numbered two</span></p>
  <p class=NoKPunktlista style='mso-list:l11 level1 lfo41'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span>&nbsp;</span></span></span><![endif]><span>Bullet one</span></p>
`;

export const conditionalBlocks = `
  <p class=NoKText><![if !supportAnnotations]><a class=msocomanchor>[JH1]</a><![endif]>Body text</p>
  <p class=NoKText><![if !vml]><img width=10 height=10 src="x.png"><![endif]>More text</p>
`;

export const singleListItem = `
  <p class=NoKPunktlista style='mso-list:l21 level1 lfo42'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span><![endif]><span>Item</span></p>
`;

export const nestedEmphasis = `
  <p class="NoKText">A <b><b>B</b></b> <i><i>C</i></i><span></span></p>
  <p class="NoKText">&nbsp;</p>
`;

export const msoCommentStyle = `
  <p class="NoKText">Keep</p>
  <p class="NoKText" style="mso-element:comment">Drop</p>
`;

export const headingWithInline = `<p class="NoKRubrik2">Intro <b>bold</b> and <i>italic</i></p>`;

export const classOrderTextFirst = `<p class="NoKText NoKRubrik2">text</p>`;

export const classOrderHeadingFirst = `<p class="NoKRubrik2 NoKText">text</p>`;

export const tableCells = `<table><tr><td><p class="NoKText">A</p></td><td><p class="NoKText">B</p></td></tr></table>`;

export const tableExtras = `<table><colgroup><col></colgroup><caption>Title</caption><tr><td><p class="NoKText">Cell</p></td></tr></table>`;

// Configs the unit tests pass to clean().
export const stripKeepConfig: Partial<DeworderConfig> = {
  mapping: {
    NoKRubrik1: "strip",
    NoKBetoningKursiv: "keep",
  },
  strip_all_classes: false,
};

export const numListConfig: Partial<DeworderConfig> = { mapping: { NumList: "ol" } };
