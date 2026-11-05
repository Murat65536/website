---
title: "3d Rendering in the Terminal"
description: "Another step closer to living entirely in the terminal"
pubDate: "2026-11-1"
tags: ["coding"]
---
I don't want to leave the terminal for anything.

I like its simplicity. It forces me to be creative when making something in it, and for applications I use to strip out bloat and just give me something that works. I don't like that Zen takes up 5gb of RAM every time I open it. I just want to use the terminal: it's resource-efficient, debloated, and really fricking cool.

What if I want to see a 3d model?

Well, I could open up [Carbonyl](https://github.com/fathyb/carbonyl) (or one of the other projects that spins up a browser), but at that point I have the same issue, don't I? Still a bunch of CPU and RAM being wasted as a result a Chromium instance. I could also get a regular 3d model viewer, but then I wouldn't exactly be in the terminal. As a Neovim user (wow who would have thought?), that's not really acceptable.

[dcat](https://github.com/Murat65536/dcat) is my solution to this. It uses Assimp to support virtually any 3d file format and WGPU to display it without any performance issues. It has got textures, animations, Kitty Graphics Protocol, Sixel, fallbacks for old terminals, wireframe toggling, keyboard controls, mouse controls, and support on Windows, Mac, and Linux. It's also a solution to see 3d models over SSH.

<video controls autoplay loop muted playsinline width="100%">
  <source src="/videos/dcat.webm" type="video/webm" />
  <source src="/videos/dcat.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

I've been developing the project for quite some time now, but I very recently switched it from C to Rust, which made cross-platform support a lot easier. There's also a [neovim plugin](https://github.com/Murat65536/dcat.nvim) for this, which automatically runs dcat when you open a 3d model file.
