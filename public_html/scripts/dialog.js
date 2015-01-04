(function ($)
{
    var openedWindows = 0;
    $.fn.window = function (options)
    {
        var settings = $.extend({
            mode: "alert",
            overlay: false,
            text: "OK",
            fade: true,
            title: "",
            msg: "",
            onOkPress: function () {
            },
            onCancelPress: function () {
            }
        }, options);
        $("<div class='windowHeader'>" + title + "</div><div class='windowBody'>" + msg + "</div>").appendTo(this);
        if (settings.fade)
        {
            this.fadeIn();
        }
        else
        {
            this.show();
        }
        if (settings.overlay)
        {
            $("#popupWindowOverlay").show();
            openedWindows++;
        }
    };
}(jQuery));
