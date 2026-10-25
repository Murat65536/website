---
title: "Terminal displays"
description: "An explanation of the convoluted mess that is terminal rendering."
pubDate: "7-20-2026"
tags: ["coding"]
---

The terminal is great at rendering text. For that, all that's needed is a print statement, but what about a picture? That's a little more complicated.

## Regular characters
Using hashtag characters (or characters of any other kind) is the simplest way to render to the terminal. It consists of something like this:
```text
    #    
   ###   
  #####  
 ####### 
#########
 ####### 
  #####  
   ###   
    #    
```
Here, the space characters represent an empty block and the hashtags represent a full block. The benefit of using this method is that it'll probably work on any terminal on the planet, but it comes the drawback of very low resolution and no color.

A variant of this is using Unicode characters, which can give you higher resolutions

Half block characters:
```text
   ▄█▄   
 ▄█████▄ 
▀███████▀
  ▀███▀ 
    ▀    
```

Quarter block characters:
```text
  ▗█▖  
 ▗███▖ 
 █████ 
 ▝███▘ 
  ▝█▘  
```

Braille characters:
```text
⠀⢠⣾⣷⣄⠀
⢾⣿⣿⣿⣿⡷
⠀⠙⠿⡿⠋⠀
```

Quarter blocks have higher resolution better than half blocks. While braille provides more resolution than quarter blocks, it comes with the side effect of looking a lot worse.

## Colors

### Truecolor

Every method discussed above has the limitation of not supporting colors. ANSI escape sequences are very helpful here. These allow you to change the color of terminal text.

This blog will use `\x1b` to indicate an escape sequence. `\033`, `\e`, and `u001b` can all also be used.

There are two color change operations that can be achieved using ANSI:
- `\x1b[38;2;{r};{g};{b}m`: Change the foreground color
- `\x1b[48;2;{r};{g};{b}m`: Change the background color

The `{r}`, `{g}`, and `{b}` sequences represent the red, green, and blue aspects of the chosen color.

After such an operation is performed, the characters proceeding it will have the color applied to them.

The simple approach to utilize these colors would be to simply pick the space character and change the background color, or to pick the full block character and change the foreground color.
However, a much better approach is to choose the half block character (`▀`) and change both the foreground and the background colors.  This works because as the name suggests, half of the character is a block, while the other half is empty.
In this case, the foreground color would set the color of the top half, while the background color would set the color of the bottom half.
In addition to doubling the vertical resolution, it also has the effect of making each "pixel" square. This is because terminal characters are usually twice as high as they are wide, and this method halves the height.

### Palette Characters
Some older terminals don't support truecolor, so using palette characters is necessary.

Just like truecolor, color changes can be applied to both the foreground and background:
- `\x1b[38;5;{color}m`: Change the foreground color
- `\x1b[48;5;{color}m`: Change the background color

Palette characters only support 256 different colors, and are therefore more limited.

On top of this, you should NOT use the colors in indices 0-15, because they can be changed (by the user, terminal theme or whatever else) and are therefore unreliable.

Wikipedia talks about how to convert from RGB to the nearest palette character color [here](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit).

The same method of getting more resolution out of truecolor also applies to palette characters.

## Optimizations
When attempting to display animations in the terminal, framerate can become an issue, especially on larger screens with lower terminal font sizes. To combat this, optimizations are often needed.

There are several optimizations that can be done to enhance performance:
- Flush only at the end of the frame
- Use an ANSI escape code to perform synchronized updates (`\x1b[?2026h` to begin and `\x1b[?2026l` to end)
- Only change the characters that have different colors on the next frame (This might not always be good because it requires extra computation)
- Chain foreground and background escape codes together `\x1b[38;2;{r};{g};{b};48;2;{r};{g};{b}m`

## Sixel
Sixel allows for actual pixel-sized pixels, but it comes at the cost of not being able to display more than 256 colors in a single frame.
It is usually not feasible to implement the Sixel protocol in a personal application because it's complicated enough that it just isn't worth the headache. For that reason, libraries are often used such as [libsixel](https://github.com/saitoha/libsixel).
If using libsixel while displaying animations, set all its configuration options to the lowest possible setting, because you're going to need all the performance you can get. Sixel is not very fast.

Not all terminals support Sixel. There's a list of the ones that do [here](https://www.arewesixelyet.com/).

## Kitty Graphics Protocol
The Kitty Graphics Protocol is the best one out of these options, but it is also the least widely supported. I won't go over the nuances of the protocol here as there's just too much to cover there's a [dedicated page](https://sw.kovidgoyal.net/kitty/graphics-protocol/) on Kitty's website that has much of the information needed to get started.

Kitty has a mode for using the shared memory buffer, which makes renders very fast (this only works on POSIX). However, attempting a framerate too high will cause a glitch where nothing renders at all. I forgot the exact reason for this, but it's also not documented as far as I could tell.

## Detecting support
Detecting support for each of these formats can be very confusing. Each mode has a different way to query support, and whether that way actually works is dependent on the terminal.

Literally nothing:
- Check if the `NO_COLOR` environment variable is set
- Check if the `TERM` environment variable is set to `dumb`

Palette characters:
- Send the OSC (operating system command) 4 query `\x1b]4;1;?\x1b\\`. This sends a query for a palette in the specified palette index (in this case 1). If the terminal responds with something along the lines of `\x1b]4;1;rgb:RRRR/GGGG/BBBB\x1b\`, it was successful.
- Check if the `TERM` environment variable is set to `256color`

Truecolor:
- Send the XTGETTCAP query `\x1bP+q524742\x1b\`, where `524747` is the hexadecimal representation of the ASCII string `RGB`. A terminal that supports truecolor will reply `\x1bP1+rRGB=8/8/8\x1b\`. The `8`s indicate 8 bits per color channel.
- Check if the `COLORTERM` environment variable equals `truecolor` or `24bit`

Sixel:
- Send the DA1 (primary device attributes) escape code `\x1b[c`. The terminal will send back a list of supported feature codes: `\x1b[?62;1;2;4;15;22c`. If the response includes `4`, the terminal supports Sixel.
- Send the XTSMGRAPHICS query `\x1b[?1;1;0S`, which queries width and height. The response format looks like `\x1b[?1;0;0;{width};{height}S`
- Send the XTSMGRAPHICS query `\x1b[?1;3;0S`, which queries available Sixel color registers. The response for this looks like `\x1b[?1;0;3;{num_colors}S`

Kitty Graphics Protocol:
- Send the XTGETTCAP query `\033P+q6b697474792d71756572792d76657273696f6e\033\` (the hex string decodes to `kitty-query-version`). The terminal will respond with something along the lines of `\033P1+r6b697474792d71756572792d76657273696f6e=302e33352e32\033\` (decodes to `kitty-query-version=0.35.2`).
- Print a 1x1 dummy image `\033_Gi=31337,s=1,v=1,a=q,t=d,f=24;AAAA\033\\`. If the terminal supports Kitty, it will respond with `\033_Gi=31337;ok\033\`
- Check if the `TERM` environment variable is set to `xterm-kitty`

Edge cases:
Sometimes on Windows, a terminal will tell you that it supports a format and then proceed to not work. This is because older versions of ConPTY are lame and stupid. They don't recognize how to handle those escape sequences. You can't really do too much about this.

Until recently, my own project [dcat](https://github.com/Murat65536/dcat) was manually doing all the escape sequence work, but I have now switched to [Chafa](https://github.com/hpjansson/chafa) and have escaped from whatever torture this is.
