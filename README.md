# Stuff Company Static Site

A static HTML/CSS recreation of stuff.company based on Wayback Machine archives.

## Quick Start

1. Open `index.html` in your browser to view the site
2. All pages are fully functional with working navigation

## Structure

```
stuff-company/
├── index.html                    # Homepage with Featured Work gallery
├── peachtree-catering/index.html # 4 YouTube video embeds
├── how-to-not-get-hired/index.html
├── south-sillycam/index.html     # 6 episode video embeds
├── south-fellini/index.html      # External link
├── larry-krasner/index.html      # 2 video embeds + contact form
├── elizabeth-fiedler/index.html  # 1 video embed
├── steel-owl-productions/index.html
├── the-48-hour-film-project/index.html # 6 short film embeds
├── do-it-now-t-shirts/index.html # External link
├── texel/index.html              # Demo link
├── zled-lighting/index.html      # 1 video embed + external link
├── css/
│   ├── style.css                 # Main stylesheet (Kale theme inspired)
│   └── responsive.css            # Mobile responsiveness
├── js/
│   └── main.js                   # Cycling tagline animation
└── images/
    ├── logo.gif                  # Animated company logo (from Wayback)
    ├── favicon/favicon.svg       # Site favicon
    └── projects/                 # Project logos and images
```

## Images

### Successfully Downloaded from Wayback Machine
- `logo.gif` - Animated company logo (753x530)
- `peachtree-catering.png` - Peachtree Catering logo
- `south-sillycam.png` - South SillyCAM logo
- `south-fellini.png` - South Fellini logo
- `larry-krasner.png` - Larry Krasner campaign logo
- `steel-owl.png` - Steel Owl Productions logo
- `48hfp.png` - 48 Hour Film Project logo
- `do-it-now.png` - Do It Now T-Shirts logo

### Created as SVG Placeholders
These images weren't available in Wayback Machine archives, so SVG placeholders were created:
- `how-to-not-get-hired.svg` - Book mockup
- `elizabeth-fiedler.svg` - Campaign logo
- `texel.svg` - Blockchain tulips illustration
- `zled.svg` - ZLED Lighting logo
- `steel-owl-tiki.svg`, `steel-owl-oxygen.svg`, `steel-owl-video.svg` - Gallery images

## Features

- **Cycling tagline**: Animates through "We Know Video/Websites/Design/Data/Print/Fabrication/Lasers/Wood/Stuff"
- **Flip cards**: Project gallery with hover-to-reveal links
- **Responsive design**: Works on desktop, tablet, and mobile
- **YouTube embeds**: 20 videos embedded from YouTube
- **Contact form**: Uses mailto: link (opens email client)
- **SVG favicon**: Works in modern browsers

## Hosting

Deploy to any static hosting:

### GitHub Pages
1. Push to a GitHub repo
2. Go to Settings > Pages
3. Select branch and save
4. For custom domain, add a `CNAME` file with `stuff.company`

### Netlify / Vercel
1. Drag and drop the `stuff-company` folder
2. Configure custom domain in settings

## Contact Form

The contact form uses `mailto:info@stuff.company` which opens the user's email client. For a real form backend, consider:
- [Formspree](https://formspree.io)
- [Netlify Forms](https://www.netlify.com/products/forms/)
- [Google Forms](https://forms.google.com) embed

## YouTube Video IDs

### Peachtree Catering
- `PUFs7PDscPY`, `vZ8WZ5_2atI`, `ESMojZgHGPw`, `ScTCXRWT3P8`

### South SillyCAM Episodes
- Ep 0: `eETH-uvKDUI`, Ep 1: `Wrn5qQInEr0`, Ep 2: `V7Od1GIA3JU`
- Ep 3: `AsQHju5GHyA`, Ep 4: `jGYatDybJ8M`, Ep 5: `QTfEGX9vYYY`

### 48 Hour Film Project
- `hJNwqezuIGE`, `1gqMKxl805Y`, `QiUryz3EOSY`
- `maMFjIqyqJ0`, `yc7pvIO-WX4`, `dsKOHb9ug7A`

### Campaign Videos
- Larry Krasner: `5FdUc5cJIpw`, `56IreFsBe7c`
- Elizabeth Fiedler: `GxwNVVK8pTA`

### ZLED Lighting
- `MfyGHCFFO-E`
