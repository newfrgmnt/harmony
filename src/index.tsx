import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Draggable, { DraggableEventHandler } from 'react-draggable';

export const harmonies = {
    triad: [120, 240],
    tetradic: [60, 180, 240],
    complementary: [180],
    analogous: [-30, 30],
    square: [90, 180, 270]
} as const;

export type ColorWheelProps = {
    harmony: keyof typeof harmonies;
    onChange?: (colors: { hue: number; saturation: number; value: number }[]) => void;
}

export const ColorWheel = ({ harmony: harmonyName, onChange }: ColorWheelProps) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [position, setPosition] = useState({ x: 144, y: 144 });

    const harmony = useMemo(() => harmonies[harmonyName], [harmonies, harmonyName]);

    useEffect(() => {
        if (!ref.current) return;
        const ctx = ref.current.getContext('2d');

        if (!ctx) return;

        ctx.canvas.width = ctx.canvas.getBoundingClientRect().width;
        ctx.canvas.height = ctx.canvas.getBoundingClientRect().height;

        drawCircle(ctx);
    }, []);

    const handleDrag: DraggableEventHandler = useCallback((e, data) => {
        if (!ref.current) return;
        let radius = ref.current.width / 2;
        let [r, phi] = xy2polar(data.x - radius, data.y - radius);
        // Limit radial distance to radius
        r = Math.min(r, radius);
        const [x, y] = polar2xy(r, phi);
        setPosition({ x: x + radius, y: y + radius });
    }, []);

    const xy2polar = useCallback((x: number, y: number): [number, number] => {
        let r = Math.sqrt(x * x + y * y);
        let phi = Math.atan2(y, x);
        return [r, phi];
    }, []);

    const polar2xy = useCallback((r: number, phi: number): [number, number] => {
        let x = r * Math.cos(phi);
        let y = r * Math.sin(phi);
        return [x, y];
    }, []);

    const rad2deg = useCallback((rad: number) => {
        return ((rad + Math.PI) / (2 * Math.PI)) * 360;
    }, []);

    const handles = useMemo(() => {
        const ctx = ref.current?.getContext('2d');

        if (!ctx) return [];

        const x = position.x - ctx.canvas.width / 2;
        const y = position.y - ctx.canvas.height / 2;

        const [r, phi] = xy2polar(x, y);

        const hue = rad2deg(phi);
        const saturation = r / (ctx.canvas.width / 2);
        const value = 1.0;

        const colors = harmony.map(combinationHue => {
            const newHue = (hue + combinationHue) % 360;
            const [x, y] = polar2xy(r, newHue * (Math.PI / 180));
            return { x: -x + ctx.canvas.width / 2, y: -y + ctx.canvas.height / 2, hue: newHue, saturation, value };
        });

        onChange?.([{ hue, saturation, value }, ...colors]);

        return colors;
    }, [position, harmony, polar2xy, onChange, xy2polar, rad2deg]);

    // hue in range [0, 360]
    // saturation, value in range [0,1]
    // return [r,g,b] each in range [0,255]
    // See: https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSV
    const hsv2rgb = useCallback((hue: number, saturation: number, value: number): [number, number, number] => {
        let chroma = value * saturation;
        let hue1 = hue / 60;
        let x = chroma * (1 - Math.abs((hue1 % 2) - 1));
        let r1: number = 0,
            g1: number = 0,
            b1: number = 0;
        if (hue1 >= 0 && hue1 <= 1) {
            [r1, g1, b1] = [chroma, x, 0];
        } else if (hue1 >= 1 && hue1 <= 2) {
            [r1, g1, b1] = [x, chroma, 0];
        } else if (hue1 >= 2 && hue1 <= 3) {
            [r1, g1, b1] = [0, chroma, x];
        } else if (hue1 >= 3 && hue1 <= 4) {
            [r1, g1, b1] = [0, x, chroma];
        } else if (hue1 >= 4 && hue1 <= 5) {
            [r1, g1, b1] = [x, 0, chroma];
        } else if (hue1 >= 5 && hue1 <= 6) {
            [r1, g1, b1] = [chroma, 0, x];
        }

        let m = value - chroma;
        let [r, g, b] = [r1 + m, g1 + m, b1 + m];

        // Change r,g,b values from [0,1] to [0,255]
        return [255 * r, 255 * g, 255 * b];
    }, []);

    const drawCircle = useCallback((ctx: CanvasRenderingContext2D) => {
        let radius = ctx.canvas.width / 2;
        let image = ctx.createImageData(2 * radius, 2 * radius);
        let data = image.data;

        for (let x = -radius; x < radius; x++) {
            for (let y = -radius; y < radius; y++) {
                let [r, phi] = xy2polar(x, y);

                if (r > radius) continue; // skip this pixel because it's outside the circle

                let deg = rad2deg(phi);

                // Figure out the starting index of this pixel in the image data array.
                let rowLength = 2 * radius;
                let adjustedX = x + radius; // convert x from [-50, 50] to [0, 100] (the coordinates of the image data array)
                let adjustedY = y + radius; // convert y from [-50, 50] to [0, 100] (the coordinates of the image data array)
                let pixelWidth = 4; // each pixel requires 4 slots in the data array
                let index = (adjustedX + adjustedY * rowLength) * pixelWidth;

                let hue = deg;
                let saturation = r / radius;
                let value = 1.0;

                let [red, green, blue] = hsv2rgb(hue, saturation, value);
                let alpha = 255;

                data[index] = red;
                data[index + 1] = green;
                data[index + 2] = blue;
                data[index + 3] = alpha;
            }
        }

        ctx.putImageData(image, 0, 0);
    }, []);

    return (
        <div 
            style={{
                position: 'relative',
                width: '300px',
                height: '300px',
            }}
        >
            <canvas 
                ref={ref} 
                style={{
                    width: '100%',
                    height: '100%',
                    border: "2px solid #fff",
                    borderRadius: "99px",
                }} 
            />
            {handles.map((position, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        top: "-12px",
                        left: "-12px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "99px",
                        border: "2px solid #fff",
                        transform: `translate(${position.x}px, ${position.y}px)`
                    }}
                />
            ))}
            <Draggable onDrag={handleDrag} position={position}>
                <div style={{
                    position: 'absolute',
                    top: "-12px",
                    left: "-12px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "99px",
                    border: "2px solid rgba(0, 0, 0, .1)",
                    backgroundColor: '#fff'
                }} />
            </Draggable>
        </div>
    );
};