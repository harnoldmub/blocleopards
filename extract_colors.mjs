import Jimp from "jimp";

async function main() {
    try {
        const image = await Jimp.read("public/brand/logo.png");
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const colorCounts = {};

        image.scan(0, 0, width, height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            if (alpha < 255) return; // Ignore transparent

            // Ignore white-ish and black-ish
            if (red > 240 && green > 240 && blue > 240) return;
            if (red < 20 && green < 20 && blue < 20) return;

            const hex = "#" + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1);

            colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        });

        const sortedColors = Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        console.log("Dominant colors:");
        sortedColors.forEach(([color, count]) => {
            console.log(`${color}: ${count}`);
        });

    } catch (err) {
        console.error(err);
    }
}

main();
