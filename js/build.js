({
    baseUrl: ".",
    paths: {
        data: "../data",
        html: "../html",
        jquery: "lib/jquery-2.0.3.min",
        "jquery.event.move": "lib/jquery.event.move",
        "jquery.event.swipe": "lib/jquery.event.swipe",
        async: "lib/async",
        rasync: "lib/rasync",
        text: "lib/text",
        mustache: "lib/mustache"
    },
    include: ["rasync"],
    name: "app.js",
    out: "app-built.js",
    preserveLicenseComments: false
})
