/** طباعة HTML كامل عبر iframe مخفي (تدعم الطابعات الحرارية وحفظ PDF من نافذة الطباعة) */
export function printHtml(html: string, onError?: () => void): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  const cleanup = () => window.setTimeout(() => frame.remove(), 1500);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      onError?.();
    } finally {
      cleanup();
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
