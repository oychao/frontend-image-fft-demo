window.addEventListener('load', function() {
    const cc = 9e-3;

    const app = document.querySelector('#app');

    const rawCanv = document.createElement('canvas');
    const dftCanv = document.createElement('canvas');
    const recCanv = document.createElement('canvas');
    const canvs = [rawCanv, dftCanv, recCanv];

    canvs.forEach(canv => app.appendChild(canv));

    const rawCtx = rawCanv.getContext('2d');
    const dftCtx = dftCanv.getContext('2d');
    const recCtx = recCanv.getContext('2d');

    const dims = [];

    let hValss = [[], [], [], []];
    let hHatss = [[], [], [], []];

    const round = function(n, places) {
        var mult = Math.pow(10, places);
        return Math.round(mult * n) / mult;
    };

    const loadImg = function() {
        const img = new Image();
        return new Promise(resolve => {
            img.addEventListener('load', function() {
                hValss.forEach((hVals, idx) => {
                    // make each canvas the image's exact size
                    dims[0] = img.width;
                    dims[1] = img.height;
                    canvs.forEach(canv => {
                        canv.width = dims[0];
                        canv.height = dims[1];
                    });

                    // draw the image to the canvas
                    rawCtx.drawImage(img, 0, 0, img.width, img.height);

                    // grab the pixels
                    const imageData = rawCtx.getImageData(0, 0, dims[0], dims[1]);
                    for (let i = 0, length = imageData.data.length; i < length; i += 4) {
                        // store all rgba values
                        hVals.push(imageData.data[i + idx]);
                    }
                });
                resolve();
            });
            img.crossOrigin = 'anonymous';
            img.src = 'grace.png';
        });
    };

    const transform = function() {
        const fftImageData = [];
        return new Promise(resolve => {
            hValss.forEach((_, idx) => {
                // compute the h hat values
                Fourier.transform(hValss[idx], hHatss[idx]);
                hHatss[idx] = Fourier.shift(hHatss[idx], dims);

                // get the largest magnitude
                let maxMagnitude = 0;
                for (let i = 0, length = hHatss[idx].length; i < length; i++) {
                    const mag = hHatss[idx][i].magnitude();
                    if (mag > maxMagnitude) {
                        maxMagnitude = mag;
                    }
                }

                // apply a low or high pass filter
                const lowPassRadius = NaN;
                const highPassRadius = NaN;
                Fourier.filter(hHatss[idx], dims, lowPassRadius, highPassRadius);

                // draw the pixels
                const currImageData = dftCtx.getImageData(0, 0, dims[0], dims[1]);
                const logOfMaxMag = Math.log(cc * maxMagnitude + 1);
                for (let k = 0; k < dims[1]; k++) {
                    for (let l = 0; l < dims[0]; l++) {
                        const idxInPixels = 4 * (dims[0] * k + l);
                        currImageData.data[idxInPixels + 3] = 255; // full alpha
                        let color = Math.log(cc * hHatss[idx][l * dims[0] + k].magnitude() + 1);
                        color = Math.round(255 * (color / logOfMaxMag));
                        // currImageData.data[idxInPixels + idx] = color;
                        // RGB are the same -> gray
                        for (let c = 0; c < 3; c++) {
                            currImageData.data[idxInPixels + c] = color;
                        }
                    }
                }
                fftImageData.push(currImageData);
            });

            let curIdx = 0;
            dftCtx.putImageData(fftImageData[curIdx], 0, 0);
            setInterval(() => {
                curIdx++;
                curIdx %= 4;
                dftCtx.putImageData(fftImageData[curIdx], 0, 0);
            }, 1e3);

            resolve();
        });
    };

    const restruct = function() {
        return new Promise(resolve => {
            const currImageData = recCtx.getImageData(0, 0, dims[0], dims[1]);
            hHatss.forEach((hHats, idx) => {
                // compute the h prime values
                const hPrimes = [];
                hHats = Fourier.unshift(hHats, dims);
                Fourier.invert(hHats, hPrimes);

                // draw the pixels
                for (let n = 0; n < dims[1]; n++) {
                    for (let m = 0; m < dims[0]; m++) {
                        const idxInPixels = 4 * (dims[0] * n + m);
                        currImageData.data[idxInPixels + idx] = round(hPrimes[n * dims[0] + m], 2);
                    }
                }
            });
            recCtx.putImageData(currImageData, 0, 0);
            resolve();
        });
    };

    loadImg()
        .then(() => transform())
        .then(() => restruct());
});
