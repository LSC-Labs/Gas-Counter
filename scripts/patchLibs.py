"""
patchLibs.py - PlatformIO pre script: fixes known bugs in downloaded libraries.

The libraries in .pio/libdeps are downloaded by PlatformIO, so the fixes are
applied before every build. The patch is idempotent (already patched files are
left untouched). If the library changed and the original code is not found,
a warning is printed - check if the bug is fixed upstream.

ESPAsyncTCP 2.0.0 (ESP8266) - AsyncClient::abort() use-after-free
------------------------------------------------------------------
abort() calls tcp_abort(). lwIP calls the error callback synchronously,
AsyncClient::_error() calls the discard callback and the owner (i.e.
ESPAsyncWebServer: request -> _handleDisconnect -> delete request -> delete client)
deletes the AsyncClient. After tcp_abort() returns, abort() still writes to the
deleted object:  _pcb = NULL;  setCloseError(ERR_ABRT);
_pcb is the first member of AsyncClient - in a freed umm_malloc block these are
the free list links. Writing NULL there corrupts the heap => random crashes in
lwIP / the WiFi SDK later (pbuf_free, memcpy to NULL in ieee80211_setup_ratetable, ...).
Triggered by every invalid request (i.e. binary data / NUL byte) to the web server,
for example by network scanners (nmap -sV like service detection).

Fix 1: clear the members and keep the error tracker alive BEFORE tcp_abort(),
do not touch the object afterwards.

ESPAsyncTCP 2.0.0 - abort() inside a lwIP callback returns ERR_OK to lwIP
---------------------------------------------------------------------------
tcp_abort() frees the pcb (tcp_free) and then calls the error callback.
AsyncClient::_s_error() marks the error tracker as errored (EE_ERROR_CB) =>
ACErrorTracker::getCallbackCloseError() returns ERR_OK instead of ERR_ABRT.
If abort() was called inside a lwIP callback of this connection (recv / accept /
sent / connected - i.e. ESPAsyncWebServer aborts a request in _onData, or a
server rejects a connection in onClient), lwIP gets ERR_OK and continues to use
the freed pcb (tcp_input / tcp_process: tcp_receive(pcb), pcb->flags, ...).
On ESP8266 the pcbs are heap allocated (MEMP_MEM_MALLOC 1) => heap corruption,
hangs, hardware watchdog resets.
lwIP rule: "Only return ERR_ABRT if you have called tcp_abort from within the callback function".

Fix 2: after tcp_abort() reset the tracker to "not errored" with close error ERR_ABRT,
so the callback returns ERR_ABRT to lwIP exactly once (getCallbackCloseError()
then sets EE_ABORTED). The tracker is kept alive by the local shared_ptr.
"""
Import("env")  # noqa: F821 - provided by PlatformIO
import os

PATCH_MARKER = "LSC-PATCH v2: abort use-after-free / ERR_ABRT"

ESPASYNCTCP_ORIGINAL = """  if(_pcb) {
    tcp_abort(_pcb);
    _pcb = NULL;
    setCloseError(ERR_ABRT);
  }
  return;
}"""

# Version 1 of the patch (only fix 1) - upgraded to version 2
ESPASYNCTCP_PATCHED_V1 = """  // LSC-PATCH: abort use-after-free (scripts/patchLibs.py):
  // tcp_abort() calls the error callback synchronously - the owner may delete
  // this object there. So clear the members first and do not touch them afterwards.
  if(_pcb) {
    tcp_pcb *pcb = _pcb;
    _pcb = NULL;
    std::shared_ptr<ACErrorTracker> errorTracker = _errorTracker;   // keeps the tracker alive
    errorTracker->setCloseError(ERR_ABRT);
    tcp_abort(pcb);       // may delete this !
  }
  return;
}"""

ESPASYNCTCP_PATCHED = """  // """ + PATCH_MARKER + """ (scripts/patchLibs.py):
  // 1) tcp_abort() calls the error callback synchronously - the owner may delete
  //    this object there. So clear the members first and do not touch them afterwards.
  // 2) tcp_abort() has freed the pcb - if we are inside a lwIP callback of this
  //    connection, it must return ERR_ABRT, otherwise lwIP uses the freed pcb.
  //    _s_error() marked the tracker as errored (=> ERR_OK) - reset it.
  if(_pcb) {
    tcp_pcb *pcb = _pcb;
    _pcb = NULL;
    std::shared_ptr<ACErrorTracker> errorTracker = _errorTracker;   // keeps the tracker alive
    errorTracker->setCloseError(ERR_ABRT);
    tcp_abort(pcb);       // may delete this !
    errorTracker->_errored     = EE_OK;       // => getCallbackCloseError() returns ERR_ABRT once
    errorTracker->_close_error = ERR_ABRT;
  }
  return;
}"""


def patch_file(path, original, patched, name):
    if not os.path.isfile(path):
        print("patchLibs: %s not found (%s) - skipped" % (name, path))
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if PATCH_MARKER in content:
        print("patchLibs: %s already patched" % name)
        return
    for src in (original if isinstance(original, (list, tuple)) else [original]):
        if src in content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content.replace(src, patched, 1))
            print("patchLibs: %s patched" % name)
            return
    print("patchLibs: WARNING - %s: original code not found, NOT patched. "
          "Check if the library changed / the bug is fixed upstream." % name)


libdeps_dir = os.path.join(env.subst("$PROJECT_LIBDEPS_DIR"), env.subst("$PIOENV"))  # noqa: F821
patch_file(os.path.join(libdeps_dir, "ESPAsyncTCP", "src", "ESPAsyncTCP.cpp"),
           [ESPASYNCTCP_ORIGINAL, ESPASYNCTCP_PATCHED_V1], ESPASYNCTCP_PATCHED,
           "ESPAsyncTCP AsyncClient::abort()")
