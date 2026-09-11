/** Local controls for candidate GLB animation review. No CDN or autoplay. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('model-viewer[data-quest-clips]').forEach((viewer) => {
    const controls = document.createElement('div');
    controls.className = 'studio-model-controls';
    const label = document.createElement('label');
    label.textContent = 'Movement preview ';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Choose a movement clip');
    const play = document.createElement('button');
    play.type = 'button'; play.textContent = 'Play';
    label.append(select); controls.append(label, play); viewer.after(controls);
    let finishFrame = 0;
    const cancelFinish = () => { cancelAnimationFrame(finishFrame); finishFrame = 0; };
    const finish = () => {
      cancelFinish(); viewer.pause(); play.textContent = 'Play';
    };
    const watchFinish = () => {
      if (!viewer.isConnected || document.hidden || viewer.paused) { cancelFinish(); return; }
      // The bundled viewer can clamp a one-shot without forwarding `finished`.
      if (viewer.duration > 0 && viewer.currentTime >= viewer.duration - 0.00001) {
        finish();
      } else finishFrame = requestAnimationFrame(watchFinish);
    };
    const reset = () => {
      select.replaceChildren();
      for (const name of viewer.availableAnimations ?? []) {
        const option = document.createElement('option'); option.value = name; option.textContent = name;
        select.append(option);
      }
      viewer.animationName = select.value;
      play.disabled = !select.options.length;
    };
    select.addEventListener('change', () => { cancelFinish(); viewer.pause(); viewer.animationName = select.value; viewer.currentTime = 0; play.textContent = 'Play'; });
    play.addEventListener('click', () => {
      if (viewer.paused) {
        if (viewer.currentTime >= viewer.duration - 0.01) viewer.currentTime = 0;
        const once = ['attack', 'hit', 'defeat', 'jump', 'interact'].includes(viewer.animationName);
        viewer.play({ repetitions: once ? 1 : Infinity });
        play.textContent = 'Pause';
        cancelFinish();
        if (once) finishFrame = requestAnimationFrame(watchFinish);
      } else {
        viewer.pause(); play.textContent = 'Play';
      }
    });
    viewer.addEventListener('finished', finish);
    viewer.addEventListener('pause', cancelFinish);
    viewer.addEventListener('load', reset);
    if (viewer.loaded) reset();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    document.querySelectorAll('model-viewer').forEach(viewer => viewer.pause?.());
    document.querySelectorAll('audio').forEach(player => player.pause());
    document.querySelectorAll('.studio-model-controls button').forEach(button => { button.textContent = 'Play'; });
  });
});
