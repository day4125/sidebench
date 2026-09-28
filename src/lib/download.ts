// Hands content to the user as a file. This, and copying, are the only ways
// content leaves a tool (INTENT.md): a blob: URL, never a request.
export function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
