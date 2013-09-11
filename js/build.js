({
    baseUrl: ".",
    paths: {
        data: "../data",
        html: "../html",
        jquery: "components/jquery/jquery.min",
        "jquery.event.move": "components/jquery.event.move/js/jquery.event.move",
        "jquery.event.swipe": "components/jquery.event.swipe/js/jquery.event.swipe",
        async: "components/async/lib/async",
        rasync: "components/requirejs-plugins/src/async",
        text: "components/requirejs-text/text",
        mustache: "components/mustache/mustache"
    },
    include: ["rasync"],
    name: "app.js",
    out: "app-built.js",
    preserveLicenseComments: false
})
