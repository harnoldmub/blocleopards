import { Jimp } from "jimp";

async function main() {
    try {
        const image = await Jimp.read("public/brand/logo.png");
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const colors = {
            red: {},
            blue: {},
            yellow: {}
        };

        image.scan(0, 0, width, height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            if (alpha < 255) return;

            const hex = "#" + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1);

            // Simple categorization
            if (red > 150 && green < 100 && blue < 100) {
                colors.red[hex] = (colors.red[hex] || 0) + 1;
            } else if (blue > 100 && red < 100 && green < 150) {
                colors.blue[hex] = (colors.blue[hex] || 0) + 1;
            } else if (red > 150 && green > 150 && blue < 100) {
                colors.yellow[hex] = (colors.yellow[hex] || 0) + 1;
            }
        });

        const getDominant = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

        console.log("Dominant Red:", getDominant(colors.red));
        console.log("Dominant Blue:", getDominant(colors.blue));
        console.log("Dominant Yellow:", getDominant(colors.yellow));

    } catch (err) {
        console.error(err);
    }
}

main();
