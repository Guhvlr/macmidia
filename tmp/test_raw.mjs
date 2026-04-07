const visionKey = "AIzaSyB2ModEtQ3_iqYhof_dSjD80ZWv88gRCFc";
const imageUrl = "https://logo-print.com/wp-content/uploads/2021/04/google-logo.png";

async function run() {
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
