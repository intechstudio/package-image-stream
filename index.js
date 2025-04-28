const fs = require("fs");
const path = require("path");
const { Jimp, ResizeStrategy } = require("jimp");

let isEnabled = false;
let controller = undefined;
let messagePorts = new Set();
let preferencePort = undefined;

let imagePath;

let messageQue = [];
let messageQueTimeoutId = undefined;
let messageQueTimeout = 180;
let imageScale = "25,10,3,1";

function queMessage(message, priority) {
  if (priority) {
    messageQue.unshift(message);
  } else {
    messageQue.push(message);
  }
  if (messageQueTimeoutId === undefined) {
    sendNextMessage();
  }
}

function sendNextMessage() {
  clearTimeout(messageQueTimeoutId);
  messageQueTimeoutId = undefined;
  let message = messageQue.shift();
  if (!message) return;

  controller.sendMessageToEditor(message);
  messageQueTimeoutId = setTimeout(sendNextMessage, messageQueTimeout);
}

exports.loadPackage = async function (gridController, persistedData) {
  controller = gridController;

  if (persistedData) {
    messageQueTimeout = persistedData.messageQueTimeout ?? 180;
    imageScale = persistedData.imageScale ?? "25,10,3,1";
    imagePath = persistedData.imagePath ?? "";
  }

  isEnabled = true;
};

exports.unloadPackage = async function () {
  clearTimeout(messageQueTimeoutId);
  controller = undefined;
  messagePorts.forEach((port) => port.close());
  messagePorts.clear();
};

exports.addMessagePort = async function (port, senderId) {
  messagePorts.add(port);
  port.postMessage({
    type: "clientInit",
    message: {},
  });
  port.on("close", () => {
    messagePorts.delete(port);
    if (port === preferencePort) {
      preferencePort = undefined;
    }
  });
  if (senderId === "preference") {
    preferencePort = port;
    port.on("message", (e) => onPreferenceMessage(e.data));
    notifyPreference();
  }

  port.start();
};

exports.sendMessage = async function (args) {
  let type = args[0];
};

let imageString;
let latestScaleSize = undefined;
const maxCharacterCount = 280;
async function scheduleAlbumCoverTransmit() {
  messageQue = [];
  queMessage(
    {
      type: "execute-lua-script",
      script: `a("")`,
    },
    false,
  );
  let image;
  try {
    image = await Jimp.read(imagePath);
  } catch (e) {
    console.error(e);
    return;
  }
  let imageScalesArray = [6, 1];
  try {
    imageScalesArray = imageScale
      .split(",")
      .map((e) => Number(e))
      .filter((e) => e > 0);
  } catch (e) {}
  for (let currScale of imageScalesArray) {
    if (latestScaleSize != currScale) {
      latestScaleSize = currScale;
      queMessage(
        {
          type: "execute-lua-script",
          script: `ss(${latestScaleSize})`,
        },
        false,
      );
    }
    let scaledImage = image.clone();
    const imageSizeWidth = 320 / latestScaleSize;
    const imageSizeHeight = 240 / latestScaleSize;
    scaledImage.resize({ w: imageSizeWidth, h: imageSizeHeight });

    imageString = "";
    for (let i = 0; i < imageSizeHeight; i++) {
      for (let j = 0; j < imageSizeWidth; j++) {
        let pixel = scaledImage.getPixelColor(j, i);
        const r = (pixel >> 24) & 0xff;
        const g = (pixel >> 16) & 0xff;
        const b = (pixel >> 8) & 0xff;

        const buffer = Buffer.from([r, g, b]);

        imageString += buffer.toString("base64");
      }
    }

    let imageIndex = 0;
    let imagePart = "";
    do {
      imagePart = imageString.substring(
        imageIndex * maxCharacterCount,
        (imageIndex + 1) * maxCharacterCount,
      );
      queMessage(
        {
          type: "execute-lua-script",
          script: `a("${imagePart}")`,
        },
        false,
      );
      imageIndex++;
    } while (imageIndex * maxCharacterCount < imageString.length);
  }
}

async function onPreferenceMessage(data) {
  if (data.type === "send-image") {
    imagePath = data.imagePath;
    scheduleAlbumCoverTransmit();
  }
  if (data.type === "save-properties") {
    messageQueTimeout = data.messageQueTimeout;
    imageScale = data.imageScale;
    imagePath = data.imagePath;

    controller.sendMessageToEditor({
      type: "persist-data",
      data: {
        messageQueTimeout,
        imageScale,
        imagePath: data.imagePath,
      },
    });
  }
}

function notifyPreference() {
  if (!preferencePort) return;

  preferencePort.postMessage({
    type: "status",
    messageQueTimeout,
    imageScale,
    imagePath,
  });
}
