(function () {
    var id = document.currentScript.getAttribute("data-id");
    var utcoffset = document.currentScript.getAttribute("data-utcoffset");
    var server = document.currentScript.getAttribute("data-server") || "https://t.counter.dev";
    var dnt = sessionStorage.getItem("doNotTrack") || localStorage.getItem("doNotTrack");

    if (!sessionStorage.getItem("_swa") && !document.referrer.startsWith(location.protocol + "//" + location.host)) {
        setTimeout(function () {
            sessionStorage.setItem("_swa", "1");
            var params = { id: id, utcoffset: utcoffset };
            if (!dnt) {
                params.referrer = document.referrer;
                params.screen = screen.width + "x" + screen.height;
            }
            fetch(server + "/track?" + new URLSearchParams(params));
        }, 4500);
    }
    if (!dnt) {
        navigator.sendBeacon(
            server + "/trackpage",
            new URLSearchParams({ id: id, page: window.location.pathname }),
        );
    }
})();
