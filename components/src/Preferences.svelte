<svelte:options customElement={{ tag: "image-stream-preference", shadow: "none" }} />

<script>
  import {
    Block,
    BlockBody,
    BlockTitle,
    MoltenPushButton,
    MeltCheckbox,
    MeltCombo
  } from "@intechstudio/grid-uikit";
  import { onMount } from "svelte";

  let imageScale = "25,10,3,1";
  let messageQueTimeout = "80";
  let imagePath = "";
  let isInitialized = false;

  // @ts-ignore
  const messagePort = createPackageMessagePort("package-image-stream", "preference");

  function sendImage() {
    messagePort.postMessage({
      type: "send-image",
      imagePath
    });
  }

  $: imageScale,  messageQueTimeout, imagePath, saveProperties();

  function saveProperties() {
    if (isInitialized){
      messagePort.postMessage({
        type: "save-properties",
        imageScale: imageScale,
        imagePath: imagePath,
        messageQueTimeout: Number(messageQueTimeout),
      });
    }
  }

  onMount(() => {
    messagePort.onmessage = (e) => {
      const data = e.data;
      if (data.type === "status") {
        messageQueTimeout = String(data.messageQueTimeout);
        imageScale = data.imageScale;
        imagePath = data.imagePath;
        isInitialized = true;
      }
    };
    messagePort.start();
    return () => {
      messagePort.close();
    };
  });
</script>

<main-app>
  <div class="px-4 bg-secondary rounded-lg">
    <Block>
      <BlockTitle>
        Image Stream
      </BlockTitle>
      
      <BlockBody>
        <MeltCombo
          title="Image path"
          bind:value={imagePath} />
        <MoltenPushButton snap="full" text="Send Image" click={sendImage} />
        <MeltCombo
          title="Scale image"
          bind:value={imageScale} />
        <MeltCombo
          title="Message que timeout"
          bind:value={messageQueTimeout} />
      </BlockBody>
    </Block>
  </div>
</main-app>