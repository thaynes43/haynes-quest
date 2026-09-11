# WO-027: Mister Hiss recognizable parody candidate

- Model: fresh native GPT-6 Astra, max, fork none. All Blender work stays on Astra.
- Scope: **one** replacement enemy, Mister Hiss v001. Root selected the exact concept saved in docs/assets/media/mister-hiss/v001. Read concept.png with view_image, prompt/provenance, AGENTS/TEAM, art pipeline and root DESIGN005/011.
- Live scene: exclusive lease granted on dispatch after WO017 released 15:08:52UTC and all jobs exited. Existing live checkpoint is /workspace/haynes-quest/era-equipment/v001/live-scene-release.blend. Preserve it and all earlier sources; no factory reset/addon unload. New remote root /workspace/haynes-quest/parody/mister-hiss/v001. One mutable author only. Record lease and release explicitly; finish/reap owned renders before final handoff.
- Own scripts/assets/parody-mister-hiss/**, runtime/model/view/motion/manifests under docs/assets/media/mister-hiss/v001 **except root concept.png/prompt.txt/concept-provenance.json**, and .agents/work-orders/027-blender-mister-hiss-evidence.md. No scene/runtime/UI/otherassets edits. No privatephotos/authdata/infrastructure or paidAPI.

## Identity and art direction

The previous six generic wooden creatures missed Tom's required recognizable pop-culture parody. Do not return to that approach. This model must instantly read as a funny **Minecraft Creeper parody**: broad cuboid head, tall narrow armless limegreen body, exactly four short cuboid feet, strong black pixel frown/face. Paper fringe, tiny crooked plum party hat and oversized diagonal confetti-popper sash provide the gag. No woodgrain, animalquadrupedbody, antlers, wings or extraarms. Keep its tall familiar silhouette and cheeky eye/brow expression. Render as a tactile softly beveled paper/toy game character, not photoreal horror. Actual reference is the sourceconcept, not earlierBlockling.

The source sheet's top dimension is approximate; final totalheight **1.00m including party hat**, feetY0, meters, glTFYup/forward-Z, unitroot scale. Frontpopperdiagonal/hatposition consistent withconcept; back musthavecontinuoussashandactualrearfeet. Popper is firmly strapped tobody (nohands). Keep surfacefringe shallow and robust; texture carries smallpapergrain, not thousands of detached thinmeshes. Use an original embeddedatlas, no downloadedtextures/meshes. No privateimageinputs. Preserveexactnamedparts/sourceconstruction andhashes.

## Runtime/animation contract

One self-containedGLB<=2MiB, <=15000renderedtriangles, <=6opaque materials/primitives, noexternaldecoder or images, useful1katlas. Root can review necessary measuredbudget tradeoff beforeunboundedrevision. Character9–16joints isenough; cleanweights, fixedworldroot, no accidentalsharedposeanimations. Requiredclips exact lowercase **idle, move, attack, hit, defeat**. Idle/moveloop; attack/hit/defeatone-shots clamp. Nativeanimationadaptersupports exactcontactfraction permodel andremoval onlyafterdefeatfinishes.

Suggestedrootdirection: idle2.5s nervousbreath/headtilt, move1.0s funnyfourfootshufflenodriftingroot; attack1.5s withcontactat0.9s(fraction0.6), increasingpuff/scrunchedeyes/hiss, thenconfettisneeze/wobble. Include smallbudgetanimatedpaperbits iftheyexportreliably; noactualexplosion. Runtimehit isshortclearflinch~0.5s. Defeat1.75–2s wobblesandsits/collapses intact, noinjurygore. Authorfinaltimingsmustrecordexactseconds/contactandallactualclips. FirstmodelsceneattachmentrootisSkeletonUtilscloned; clipsmusttargetresolvingnodes/bonesandnottranslateScene itself. Noattackroottravel; server/localcontroller ownsposition. Facecananimatevia bones or morphs ifsimpleandvalidated, but avoidunsupportedfeatures.

## Required delivery and lead review

Early compactcheckpoint: source/buildsaved, quickactualGLB threequarter+front/back aftermodeling, exactcounts anddimensions. Sendroot thosefor recognizability/constructionreview beforepolishingallrenders. Rootmayrequestoneboundedcorrection. Do notinterpretleadselectionasownerapproval.

Final: editableblendmaster, GLB, front/side/back/beautyactualre-importedexport, motion-grid, all5clips videoandonecombinedreel plus turntable, source/construction/atlas, Khronos report, actualThree/WebGL/browserintake ifexistingtoolsavailable, exactbyte/hashmanifest. Retainoldversions. Validategeometry/bind/rest/clipdeformation/rootdrift/ground/budget, transparent/externalresourceabsence, actual4feet/sash/hat/poppersurvivalacrossexport. Hashverifytransferofmastersandallruntimefiles viaauthoringservice artifacts route. Noemptyplaceholdermediaorclaimedviewsthatarenotrendered. Rootwritesuser-facingreviewpageandselectsintegration.

Commitownedfiles withcompleteevidence; returncommits, exactGLBhash/bytes/tri/materials/clips/contact, sourcepaths/checks/limits, lease/processrelease. NoPR/push; rootcarriescheckedintegrationPR. Don'texpandtootherparodieswithoutnewworkorder/dispatch.
