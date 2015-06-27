/* global isSmall */
var windows = new Object();
var windowsByName = new Object();
var windowCount = 0;
var focused = -1;
$("#chatterboxWindows").on("click", ".cbWindowClose", function() {
    windows[$(this).attr('data-window')].hide();
}).on("mousedown", ".cbWindow", function() {
    var window = windows[$(this).attr("data-id")];
    if (window.isFocused()) return;
    if (focused !== -1) {
        focused.setFocused(false);
    }
    window.setFocused(true);
    focused = window;
});

function cbWindow(name, width, height, title, content, config) {
    var name = name;
    if (name in window.windowsByName) {
        console.warn("Overriding " + name + " in windowsByName");
    }
    window.windowsByName[name] = this;
    windowCount++;
    var id = windowCount;
    windows[id] = this;
    var width = width;
    var height = height;
    var title = title;
    var obj = this;
    var focused = false;
    var save, allowFullscreen, allowResize, fullscreen, zindex, object;
    this.init = function(content, config) {
        save = (typeof config.save === "undefined" ? false : config.save);
        allowFullscreen = (typeof config.fullscreen === "undefined" ? true : config.fullscreen);
        allowResize = (typeof config.resize === "undefined" ? true : config.resize);
        fullscreen = false;
        zindex = Object.keys(windows).length + 2;
        $("#chatterboxWindows").append("\
    <div class='cbWindow' data-id='" + id + "' style='z-index:" + zindex + ";width:" + width + "px;height:" + height + "px;display:none;'>\n\
        <div class='cbWindowHeader'>\n\
            " + title + "\n\
            <span class='cbWindowHeaderIcons'>\n\
                <img src='imgs/close.png' alt='Close' class='cbWindowClose' data-window='" + id + "' />\n\
            </span>\n\
        </div>\n\
        <div class='cbWindowBody' style='height:" + (height - 50) + "px;'>\n\
            " + content + "\n\
        </div>\n\
    </div>");
        object = $(".cbWindow[data-id='" + id + "']");
        if (isSmall) {
            object.css("top", 0).css("left", 0);
        }
        object.draggable({containment: "#chatterboxMain", scroll: false, handle: ".cbWindowHeader", cancel: ".cbWindowHeaderIcons", snap: ".cbWindow, #chatterboxMain"});
        if (allowResize) {
            object.resizable({containment: "#chatterboxMain", minHeight: 100, minWidth: 250, resize: function(event, ui) {
                ui.element.children(".cbWindowBody").css("height", ui.size.height - 50);
                width = ui.size.width;
                height = ui.size.height;
            }});
        }
    };
    this.init(content, config);
    //Begin methods
    this.getElement = function() {
        return object.children(".cbWindowBody");
    };
    this.isFullscreen = function() {
        return fullscreen;
    };
    this.setFullscreen = function(full) {
        if (!allowFullscreen || fullscreen === full) return;
        fullscreen = full;
        if (full) {
            //TODO: Resize window to fullscreen, disable resizing
        } else {
            object.css("width", width).css("height", height).children(".cbWindowBody").css("height", height - 50);
        }
    };
    this.show = function() {
        object.show();
    };
    this.hide = function() {
        object.hide();
    };
    this.isOpen = function() {
        return object.css("display") !== "none";
    };
    this.getName = function() {
        return name;
    };
    this.setPosition = function(top, left) {
        object.css("top", top).css("left", left);
    };
    this.isSaveable = function() {
        return save;
    };
    this.isFocused = function() {
        return focused;
    };
    this.setFocused = function(foc) {
        if (focused === foc) return;
        focused = foc;
        if (foc) {
            object.css("z-index", 99);
        } else {
            object.css("z-index", zindex);
        }
    };
    this.delete = function() {
        if (focused) {
            window.focused = -1;
        }
        delete windows[id];
        delete windowsByName[name];
        object.remove();
    };
}