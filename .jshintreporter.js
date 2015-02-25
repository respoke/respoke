"use strict";
/**
 * Console output reporter for jshint.
 */
module.exports = {
    reporter: function (res, files) {
        var len = res.length;
        var str = "";

        res.forEach(function (r) {
            var file = r.file;
            var err = r.error;

            str += file + ": line " + err.line + ", col " +
                err.character + ", " + err.reason + "\n";
        });

        if (str) {
            process.stdout.write(str + "\n" + len + " error" + ((len === 1) ? "" : "s")
                + ' in ' + files.length + " files.\n");
        } else {
            console.log(files.length + ' files passed jshint.\n');
        }
    }
};
