# Local Optics inference fixtures

Used only by `e2e/local-optics-inference.spec.ts` to check that the real MediaPipe model runs.
No fixture shows a minor, and none was captured for this project.

| File | Content | Source | Licence | SHA-256 |
|---|---|---|---|---|
| `one-face-nasa-eileen-collins.png` | Portrait of astronaut Eileen Collins (adult, one face) | NASA Great Images database, as distributed by scikit-image (`src/_skimage2/data/astronaut.png` at `e098ebbb684788df60b42e3bde112c014d0d9517`; its registry pins the same hash) | Public domain (US government work; scikit-image: "No known copyright restrictions, released into the public domain") | `88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5` |
| `no-face-still-life.jpg` | Table with food and wine bottle, no person | google-ai-edge/mediapipe-samples `examples/object_detection/android/app/src/androidTest/assets/test_image.jpg` at `90e4a0e8f162e20dcf1df7c688d30b9b1dbe3370` | Apache-2.0 (repository licence) | `16baa91a2091bff0160a9cecc54d07011a1d694e47b988a17bf934f80925471c` |

The multiple-face input is generated at test time from two head-and-shoulders crops of the
public-domain portrait placed side by side; it is not a photograph of two people.
