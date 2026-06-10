const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const fs = require("fs");
const path = require("path");

module.exports = function withNotificationIcon(config) {
  const empresa = "citygo";

  const iconMap = {
    citygo: "assets/notification_icon.png",
  };

  const iconSource = iconMap[empresa];

  if (!iconSource) {
    console.log("No notification icon defined for empresa:", empresa);
    return config;
  }

  // 1️⃣ Copiar icono al drawable
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const drawablePath = path.join(
        projectRoot,
        "android/app/src/main/res/drawable"
      );

      if (!fs.existsSync(drawablePath)) {
        fs.mkdirSync(drawablePath, { recursive: true });
      }

      const sourcePath = path.join(projectRoot, iconSource);
      const targetPath = path.join(drawablePath, "ic_notification.png");

      fs.copyFileSync(sourcePath, targetPath);

      console.log("Notification icon copied for:", empresa);

      return config;
    },
  ]);

  // 2️⃣ Modificar AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] =
        "http://schemas.android.com/tools";
    }

    const app = manifest.application[0];

    if (!app["meta-data"]) {
      app["meta-data"] = [];
    }

    // 2.1 Actualizar o agregar el metadato del icono
    const iconMetaData = app["meta-data"].find(
      (m) => m.$["android:name"] === "com.google.firebase.messaging.default_notification_icon"
    );
    if (iconMetaData) {
      iconMetaData.$["android:resource"] = "@drawable/ic_notification";
      iconMetaData.$["tools:replace"] = "android:resource";
    } else {
      app["meta-data"].push({
        $: {
          "android:name": "com.google.firebase.messaging.default_notification_icon",
          "android:resource": "@drawable/ic_notification",
          "tools:replace": "android:resource",
        },
      });
    }

    // 2.2 Actualizar o agregar el metadato del color
    const colorMetaData = app["meta-data"].find(
      (m) => m.$["android:name"] === "com.google.firebase.messaging.default_notification_color"
    );
    if (colorMetaData) {
      colorMetaData.$["android:resource"] = "@color/notification_icon_color";
      colorMetaData.$["tools:replace"] = "android:resource";
    } else {
      app["meta-data"].push({
        $: {
          "android:name": "com.google.firebase.messaging.default_notification_color",
          "android:resource": "@color/notification_icon_color",
          "tools:replace": "android:resource",
        },
      });
    }

    return config;
  });

  return config;
};