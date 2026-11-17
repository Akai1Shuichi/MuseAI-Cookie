"use strict";

// Một định dạng duy nhất: "tên=giá trị; tên=giá trị" (giống header Cookie).
const SESSION_COOKIES = ["hatch_sess", "hatch_native_auth_device"];
const LIFETIME_SEC = 7 * 86400;   // cookie nhập vào được giữ 7 ngày

const $ = (id) => document.getElementById(id);

function say(text, kind = "") {
  $("msg").textContent = text;
  $("msg").className = "msg " + kind;
}

async function museCookies() {
  const all = await chrome.cookies.getAll({ domain: "muse.ai" });
  return all.filter((c) => /(^|\.)muse\.ai$/.test(c.domain.replace(/^\./, "")));
}

function urlOf(c) {
  return "https://" + c.domain.replace(/^\./, "") + (c.path || "/");
}

async function refreshStatus() {
  const names = (await museCookies()).map((c) => c.name);
  const ok = SESSION_COOKIES.every((n) => names.includes(n));
  $("status").textContent = ok ? "● Đã đăng nhập muse.ai" : "● Chưa đăng nhập muse.ai";
  $("status").className = "status" + (ok ? " ok" : "");
}

async function onExport() {
  try {
    const cookies = await museCookies();
    if (!cookies.length) throw new Error("Không có cookie muse.ai. Hãy đăng nhập muse.ai trước.");
    const text = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    $("cookie").value = text;
    await navigator.clipboard.writeText(text);
    say(`Đã copy ${cookies.length} cookie.`, "ok");
  } catch (e) {
    say(e.message, "err");
  }
}

async function onImport() {
  try {
    let text = $("cookie").value.trim().replace(/^cookie:\s*/i, "");
    const pairs = text.split(";")
      .map((part) => {
        const i = part.indexOf("=");
        return i > 0 ? [part.slice(0, i).trim(), part.slice(i + 1).trim()] : null;
      })
      .filter((p) => p && p[0]);
    if (!pairs.length) throw new Error("Chưa có cookie. Dán chuỗi dạng tên=giá trị; tên=giá trị");
    const missing = SESSION_COOKIES.filter((n) => !pairs.some(([name]) => name === n));
    if (missing.length) throw new Error("Thiếu cookie: " + missing.join(", "));

    // Xóa cookie cũ để cookie cũ cùng tên không đè lên cookie mới.
    for (const c of await museCookies()) {
      await chrome.cookies.remove({ url: urlOf(c), name: c.name, storeId: c.storeId });
    }
    const expirationDate = Date.now() / 1000 + LIFETIME_SEC;
    for (const [name, value] of pairs) {
      await chrome.cookies.set({
        url: "https://muse.ai/", domain: ".muse.ai", path: "/", name, value,
        secure: true, httpOnly: name.startsWith("hatch_"), sameSite: "lax", expirationDate,
      });
    }

    const tabs = await chrome.tabs.query({ url: ["https://muse.ai/*", "https://*.muse.ai/*"] });
    tabs.forEach((t) => chrome.tabs.reload(t.id));
    say(`Đã nhập ${pairs.length} cookie.` + (tabs.length ? " Đã tải lại tab muse.ai." : ""), "ok");
    refreshStatus();
  } catch (e) {
    say(e.message, "err");
  }
}

$("export").addEventListener("click", onExport);
$("import").addEventListener("click", onImport);
refreshStatus();
