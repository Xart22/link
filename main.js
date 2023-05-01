const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const OpenBlockLink = require("./src/index");
const axios = require("axios");
const fs = require("fs");
const extract = require("extract-zip");
const Downloader = require("nodejs-file-downloader");

const link = new OpenBlockLink();
const startService = async () => {
    link.listen();

    link.on("ready", () => {
        console.info("Server is ready.");
    });

    link.on("address-in-use", () => {
        console.info("Address in use.");
    });
};

const syncLibary = async () => {
    try {
        const versionFile = JSON.parse(
            fs.readFileSync(path.join(__dirname, "tools/version.json"), "utf8")
        );
        const response = await axios.get(
            "https://nomo-kit.com/api/check-update"
        );
        const data = response.data;
        if (data.version !== versionFile.version) {
            fs.rmSync(path.join(__dirname, "tools/Arduino/libraries"), {
                recursive: true,
                force: true,
            });
            const downloader = new Downloader({
                url: data.url,
                directory: path.join(__dirname, "tools/Arduino/libraries"),
            });

            const { filePath, downloadStatus } = await downloader.download();
            if (downloadStatus === "COMPLETE") {
                console.log("Download completed");
                await extract(
                    filePath,
                    { dir: path.join(__dirname, "tools/Arduino/libraries") },
                    function (err) {
                        if (err) {
                            console.log(err);
                        }
                    }
                );

                fs.readdir(
                    path.join(__dirname, "tools/Arduino/libraries"),
                    (err, files) => {
                        files.forEach(async (file) => {
                            if (file !== data.version + ".zip") {
                                await extract(
                                    path.join(
                                        __dirname,
                                        "tools/Arduino/libraries/" + file
                                    ),
                                    {
                                        dir: path.join(
                                            __dirname,
                                            "tools/Arduino/libraries"
                                        ),
                                    },
                                    function (err) {
                                        if (err) {
                                            console.log(err);
                                        }
                                    }
                                );
                                fs.unlinkSync(
                                    path.join(
                                        __dirname,
                                        "tools/Arduino/libraries/" + file
                                    )
                                );
                            } else {
                                fs.unlinkSync(
                                    path.join(
                                        __dirname,
                                        "tools/Arduino/libraries",
                                        file
                                    )
                                );
                            }
                        });
                    }
                );

                fs.writeFileSync(
                    path.join(__dirname, "tools/version.json"),
                    JSON.stringify(data)
                );
            }
        }
    } catch (error) {
        console.log(error);
    }
};

const kill = require("kill-port");

async function createWindow() {
    const win = new BrowserWindow({
        width: 400,
        height: 330,
        maxHeight: 330,
        maxWidth: 400,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "assets/icons/nomo.png"),
        title: "Nomokit-link",
        fullscreenable: false,
        fullscreen: false,
    });
    win.removeMenu();
    // win.webContents.openDevTools();
    var contextMenu = Menu.buildFromTemplate([
        {
            label: "Show App",
            click: function () {
                win.show();
            },
        },
        {
            label: "Close",
            click: function () {
                app.isQuiting = true;
                app.quit();
            },
        },
    ]);
    let appIcon = new Tray(path.join(__dirname, "assets/icons/nomo.png"));
    appIcon.setToolTip("Nomo");
    appIcon.setContextMenu(contextMenu);

    win.loadFile("index.html");
    win.on("closed", async () => {
        console.log("closed");
        await stopService();
    });

    win.on("minimize", function (event) {
        event.preventDefault();
        win.hide();
    });
}

app.whenReady().then(async () => {
    createWindow();
    await syncLibary();
    startService();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", async () => {
    if (process.platform !== "darwin") {
        await stopService();
        app.quit();
    }
});

app.on("minimize", function (event) {
    console.log("minimize");
    event.preventDefault();
    app.hide();
});

const stopService = async () => {
    await kill(20111, "tcp").then(() => {
        console.log("Port 20111 is now free");
    });
};
