var vertex = `
		attribute vec2 uv;
		attribute vec2 position;
		varying vec2 vUv;
		void main() {
				vUv = uv;
				gl_Position = vec4(position, 0, 1);
		}
`;
var fragment = `
		precision highp float;
		precision highp int;
		uniform sampler2D tWater;
		uniform sampler2D tFlow;
		uniform float uTime;
		varying vec2 vUv;
		uniform vec4 res;
		uniform vec2 img;

		vec2 centeredAspectRatio(vec2 uvs, vec2 factor){
				return uvs * factor - factor /2. + 0.5;
		}

		void main() {

			// R and G values are velocity in the x and y direction
			// B value is the velocity length
			vec3 flow = texture2D(tFlow, vUv).rgb;

			vec2 uv = .5 * gl_FragCoord.xy / res.xy ;

			// vec2 uv = .5 * gl_FragCoord.xy / res.xy ;
			vec2 myUV = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV -= flow.xy * (0.15 * 1.2);

			vec2 myUV2 = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV2 -= flow.xy * (0.125 * 1.2);

			vec2 myUV3 = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV3 -= flow.xy * (0.10 * 1.4);

			vec3 tex = texture2D(tWater, myUV).rgb;
			vec3 tex2 = texture2D(tWater, myUV2).rgb;
			vec3 tex3 = texture2D(tWater, myUV3).rgb;

			gl_FragColor = vec4(tex.r, tex2.g, tex3.b, 1.0);
		}
`;
{
  var _size = [2048, 1638];
  var renderer = new ogl.Renderer({ dpr: 2 });
  var gl = renderer.gl;
  document.body.appendChild(gl.canvas);

  // Variable inputs to control flowmap
  var aspect = 1;
  var mouse = new ogl.Vec2(-1);
  var velocity = new ogl.Vec2();
  function resize() {
    gl.canvas.width = window.innerWidth * 2.0;
    gl.canvas.height = window.innerHeight * 2.0;
    gl.canvas.style.width = window.innerWidth + "px";
    gl.canvas.style.height = window.innerHeight + "px";

    var a1, a2;
    var imageAspect = _size[1] / _size[0];
    if (window.innerHeight / window.innerWidth < imageAspect) {
      a1 = 1;
      a2 = window.innerHeight / window.innerWidth / imageAspect;
    } else {
      a1 = window.innerWidth / window.innerHeight * imageAspect;
      a2 = 1;
    }
    mesh.program.uniforms.res.value = new ogl.Vec4(
    window.innerWidth,
    window.innerHeight,
    a1,
    a2);


    renderer.setSize(window.innerWidth, window.innerHeight);
    aspect = window.innerWidth / window.innerHeight;
  }
  var flowmap = new ogl.Flowmap(gl, {
    falloff: 0.3,
    dissipation: 0.92,
    alpha: 0.5 });

  // Triangle that includes -1 to 1 range for 'position', and 0 to 1 range for 'uv'.
  var geometry = new ogl.Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([-1, -1, 3, -1, -1, 3]) },

    uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) } });

  var texture = new ogl.Texture(gl, {
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR });

  var img = new Image();
  img.onload = () => texture.image = img;
  img.crossOrigin = "Anonymous";
  img.src = "https://images.unsplash.com/photo-1635103723394-10dab9619874?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80";

  var a1, a2;
  var imageAspect = _size[1] / _size[0];
  if (window.innerHeight / window.innerWidth < imageAspect) {
    a1 = 1;
    a2 = window.innerHeight / window.innerWidth / imageAspect;
  } else {
    a1 = window.innerWidth / window.innerHeight * imageAspect;
    a2 = 1;
  }

  var program = new ogl.Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime: { value: 0 },
      tWater: { value: texture },
      res: {
        value: new ogl.Vec4(window.innerWidth, window.innerHeight, a1, a2) },

      img: { value: new ogl.Vec2(_size[1], _size[0]) },
      // Note that the uniform is applied without using an object and value property
      // This is because the class alternates this texture between two render targets
      // and updates the value property after each render.
      tFlow: flowmap.uniform } });


  var mesh = new ogl.Mesh(gl, { geometry, program });

  window.addEventListener("resize", resize, false);
  resize();

  // Create handlers to get mouse position and velocity
  var isTouchCapable = ("ontouchstart" in window);
  if (isTouchCapable) {
    window.addEventListener("touchstart", updateMouse, false);
    window.addEventListener("touchmove", updateMouse, { passive: false });
  } else {
    window.addEventListener("mousemove", updateMouse, false);
  }
  var lastTime;
  var lastMouse = new ogl.Vec2();
  function updateMouse(e) {
    e.preventDefault();

    if (e.changedTouches && e.changedTouches.length) {
      e.x = e.changedTouches[0].pageX;
      e.y = e.changedTouches[0].pageY;
    }
    if (e.x === undefined) {
      e.x = e.pageX;
      e.y = e.pageY;
    }
    // Get mouse value in 0 to 1 range, with y flipped
    mouse.set(e.x / gl.renderer.width, 1.0 - e.y / gl.renderer.height);
    // Calculate velocity
    if (!lastTime) {
      // First frame
      lastTime = performance.now();
      lastMouse.set(e.x, e.y);
    }

    var deltaX = e.x - lastMouse.x;
    var deltaY = e.y - lastMouse.y;

    lastMouse.set(e.x, e.y);

    var time = performance.now();

    // Avoid dividing by 0
    var delta = Math.max(10.4, time - lastTime);
    lastTime = time;
    velocity.x = deltaX / delta;
    velocity.y = deltaY / delta;
    // Flag update to prevent hanging velocity values when not moving
    velocity.needsUpdate = true;
  }
  requestAnimationFrame(update);
  function update(t) {
    requestAnimationFrame(update);
    // Reset velocity when mouse not moving
    if (!velocity.needsUpdate) {
      mouse.set(-1);
      velocity.set(0);
    }
    velocity.needsUpdate = false;
    // Update flowmap inputs
    flowmap.aspect = aspect;
    flowmap.mouse.copy(mouse);
    // Ease velocity input, slower when fading out
    flowmap.velocity.lerp(velocity, velocity.len ? 0.15 : 0.1);
    flowmap.update();
    program.uniforms.uTime.value = t * 0.01;
    renderer.render({ scene: mesh });
  }

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  let region = new Path2D('M 412.7 70.801 L 403.7 70.801 L 403.7 18.801 L 412.4 18.801 L 412.4 27.501 Q 415.2 23.301 419.5 20.451 A 17.205 17.205 0 0 1 428.702 17.609 A 20.858 20.858 0 0 1 429.3 17.601 A 20.994 20.994 0 0 1 433.717 18.04 Q 436.703 18.683 438.985 20.264 A 13.128 13.128 0 0 1 439.45 20.601 A 15.751 15.751 0 0 1 444.898 28.29 A 19.154 19.154 0 0 1 445 28.601 Q 448.1 24.001 452.35 20.801 A 15.669 15.669 0 0 1 459.141 17.917 A 21.446 21.446 0 0 1 462.9 17.601 A 21.437 21.437 0 0 1 467.788 18.123 Q 471.374 18.963 473.863 21.152 A 12.994 12.994 0 0 1 475.55 22.951 A 18.992 18.992 0 0 1 478.961 30.223 Q 479.7 33.273 479.7 36.901 L 479.7 70.801 L 470.7 70.801 L 470.7 37.601 A 19.042 19.042 0 0 0 470.363 33.911 Q 469.927 31.706 468.928 29.962 A 10.982 10.982 0 0 0 468.2 28.851 A 7.974 7.974 0 0 0 462.387 25.555 A 10.678 10.678 0 0 0 461.3 25.501 A 11.926 11.926 0 0 0 454.541 27.628 A 15.996 15.996 0 0 0 452.95 28.851 Q 449.1 32.201 446.2 36.701 L 446.2 70.801 L 437.2 70.801 L 437.2 37.601 A 19.042 19.042 0 0 0 436.863 33.911 Q 436.427 31.706 435.428 29.962 A 10.982 10.982 0 0 0 434.7 28.851 A 7.974 7.974 0 0 0 428.887 25.555 A 10.678 10.678 0 0 0 427.8 25.501 A 12.02 12.02 0 0 0 421.481 27.329 A 16.244 16.244 0 0 0 419.5 28.751 Q 415.6 32.001 412.7 36.401 L 412.7 70.801 Z M 248.6 70.801 L 206.6 70.801 L 206.6 0.801 L 248.6 0.801 L 248.6 9.001 L 216.1 9.001 L 216.1 30.301 L 244.1 30.301 L 244.1 38.301 L 216.1 38.301 L 216.1 62.601 L 248.6 62.601 L 248.6 70.801 Z M 125.4 70.801 L 116.4 70.801 L 116.4 18.801 L 125.1 18.801 L 125.1 27.501 Q 127.9 23.301 132.25 20.451 A 17.316 17.316 0 0 1 139.356 17.826 A 22.629 22.629 0 0 1 142.6 17.601 A 23.225 23.225 0 0 1 147.665 18.118 Q 152.759 19.257 155.75 22.901 Q 159.875 27.926 160.088 36.009 A 33.764 33.764 0 0 1 160.1 36.901 L 160.1 70.801 L 151.1 70.801 L 151.1 37.901 A 19.265 19.265 0 0 0 150.758 34.16 Q 150.319 31.945 149.319 30.197 A 10.966 10.966 0 0 0 148.45 28.901 A 8.579 8.579 0 0 0 142.173 25.547 A 12.061 12.061 0 0 0 141.1 25.501 A 13.122 13.122 0 0 0 134.251 27.464 A 17.353 17.353 0 0 0 132.4 28.751 Q 128.3 32.001 125.4 36.401 L 125.4 70.801 Z M 565.9 70.801 L 556.9 70.801 L 556.9 18.801 L 565.6 18.801 L 565.6 27.501 Q 568.4 23.301 572.75 20.451 A 17.316 17.316 0 0 1 579.856 17.826 A 22.629 22.629 0 0 1 583.1 17.601 A 23.225 23.225 0 0 1 588.165 18.118 Q 593.259 19.257 596.25 22.901 Q 600.375 27.926 600.588 36.009 A 33.764 33.764 0 0 1 600.6 36.901 L 600.6 70.801 L 591.6 70.801 L 591.6 37.901 A 19.265 19.265 0 0 0 591.258 34.16 Q 590.819 31.945 589.819 30.197 A 10.966 10.966 0 0 0 588.95 28.901 A 8.579 8.579 0 0 0 582.673 25.547 A 12.061 12.061 0 0 0 581.6 25.501 A 13.122 13.122 0 0 0 574.751 27.464 A 17.353 17.353 0 0 0 572.9 28.751 Q 568.8 32.001 565.9 36.401 L 565.9 70.801 Z M 0 70.601 L 0 1.001 A 100.907 100.907 0 0 1 1.856 0.807 Q 4.753 0.53 8.576 0.308 A 270.552 270.552 0 0 1 8.7 0.301 A 168.416 168.416 0 0 1 13.537 0.096 Q 16.008 0.024 18.745 0.007 A 285.352 285.352 0 0 1 20.6 0.001 Q 29 0.001 34.859 2.089 A 22.604 22.604 0 0 1 40.3 4.851 A 16.711 16.711 0 0 1 44.863 9.508 Q 47.054 12.941 47.191 17.401 A 19.526 19.526 0 0 1 47.2 18.001 A 17.052 17.052 0 0 1 46.573 22.72 A 13.798 13.798 0 0 1 44.25 27.351 Q 41.3 31.201 35.7 33.701 A 30.217 30.217 0 0 1 40.336 35.761 Q 43.813 37.694 46 40.351 Q 49.5 44.601 49.5 50.801 Q 49.5 60.115 42.29 65.729 A 22.979 22.979 0 0 1 42 65.951 A 24.681 24.681 0 0 1 34.623 69.661 Q 28.579 71.601 20.2 71.601 A 221.836 221.836 0 0 1 12.12 71.459 A 187.566 187.566 0 0 1 8.65 71.301 A 227.449 227.449 0 0 1 6.066 71.144 Q 3.259 70.958 1.195 70.738 A 65.535 65.535 0 0 1 0 70.601 Z M 104.1 48.501 L 67.7 48.501 A 24.088 24.088 0 0 0 68.839 53.526 Q 70.175 57.338 72.8 59.901 Q 77 64.001 83.9 64.001 Q 88.4 64.001 92 63.051 Q 95.6 62.101 98.9 60.601 L 101 68.301 A 40.77 40.77 0 0 1 96.665 69.927 A 51.863 51.863 0 0 1 92.9 70.951 A 38.914 38.914 0 0 1 87.808 71.77 A 52.025 52.025 0 0 1 82.8 72.001 A 28.318 28.318 0 0 1 75.054 70.995 A 21.108 21.108 0 0 1 65.05 64.851 A 23.521 23.521 0 0 1 59.845 55.311 Q 58.5 50.646 58.5 44.801 A 35.359 35.359 0 0 1 59.333 36.979 A 28.84 28.84 0 0 1 61.45 30.851 A 24.642 24.642 0 0 1 66.466 23.769 A 22.887 22.887 0 0 1 69.7 21.151 A 21.048 21.048 0 0 1 79.959 17.679 A 26.205 26.205 0 0 1 82 17.601 Q 89.5 17.601 94.45 20.851 Q 99.4 24.101 101.9 29.601 A 28.185 28.185 0 0 1 104.326 39.464 A 33.434 33.434 0 0 1 104.4 41.701 A 75.204 75.204 0 0 1 104.109 48.397 A 69.426 69.426 0 0 1 104.1 48.501 Z M 351.5 48.501 L 315.1 48.501 A 24.088 24.088 0 0 0 316.239 53.526 Q 317.575 57.338 320.2 59.901 Q 324.4 64.001 331.3 64.001 Q 335.8 64.001 339.4 63.051 Q 343 62.101 346.3 60.601 L 348.4 68.301 A 40.77 40.77 0 0 1 344.065 69.927 A 51.863 51.863 0 0 1 340.3 70.951 A 38.914 38.914 0 0 1 335.208 71.77 A 52.025 52.025 0 0 1 330.2 72.001 A 28.318 28.318 0 0 1 322.454 70.995 A 21.108 21.108 0 0 1 312.45 64.851 A 23.521 23.521 0 0 1 307.245 55.311 Q 305.9 50.646 305.9 44.801 A 35.359 35.359 0 0 1 306.733 36.979 A 28.84 28.84 0 0 1 308.85 30.851 A 24.642 24.642 0 0 1 313.866 23.769 A 22.887 22.887 0 0 1 317.1 21.151 A 21.048 21.048 0 0 1 327.359 17.679 A 26.205 26.205 0 0 1 329.4 17.601 Q 336.9 17.601 341.85 20.851 Q 346.8 24.101 349.3 29.601 A 28.185 28.185 0 0 1 351.726 39.464 A 33.434 33.434 0 0 1 351.8 41.701 A 75.204 75.204 0 0 1 351.509 48.397 A 69.426 69.426 0 0 1 351.5 48.501 Z M 281.4 70.801 L 272 70.801 L 251.1 21.201 L 259.3 17.801 L 277 60.601 L 294.7 17.801 L 302.4 21.201 L 281.4 70.801 Z M 530.8 23.001 L 530.8 18.801 L 539 18.801 L 539 58.201 A 12.15 12.15 0 0 0 539.102 59.836 Q 539.434 62.27 540.85 63.151 Q 542.7 64.301 544.9 64.301 L 543 71.301 A 17.722 17.722 0 0 1 538.735 70.828 Q 533.098 69.428 531.503 63.881 A 13.59 13.59 0 0 1 531.4 63.501 A 21.307 21.307 0 0 1 528.29 66.927 A 28.498 28.498 0 0 1 525.15 69.351 Q 521.2 72.001 515.1 72.001 Q 508.6 72.001 503.3 68.701 A 22.947 22.947 0 0 1 495.887 61.174 A 27.923 27.923 0 0 1 494.85 59.351 A 27.228 27.228 0 0 1 492.22 51.408 A 36.644 36.644 0 0 1 491.7 45.101 A 33.142 33.142 0 0 1 492.697 36.832 A 27.968 27.968 0 0 1 494.85 31.101 Q 498 24.901 503.55 21.251 A 22.297 22.297 0 0 1 514.745 17.644 A 27.388 27.388 0 0 1 516.3 17.601 A 22.584 22.584 0 0 1 521.094 18.091 A 18.703 18.703 0 0 1 524.45 19.151 A 26.002 26.002 0 0 1 528.737 21.444 A 22.103 22.103 0 0 1 530.8 23.001 Z M 372.8 70.801 L 363.8 70.801 L 363.8 18.801 L 372.5 18.801 L 372.5 30.101 Q 373.8 26.801 376 23.951 Q 378.2 21.101 381.5 19.351 A 14.817 14.817 0 0 1 386.18 17.827 A 19.459 19.459 0 0 1 389.2 17.601 Q 390.7 17.601 392.2 17.751 A 18.972 18.972 0 0 1 393.255 17.884 Q 393.755 17.963 394.182 18.063 A 8.817 8.817 0 0 1 394.7 18.201 L 392 27.501 A 9.763 9.763 0 0 0 389.855 26.888 Q 388.759 26.701 387.5 26.701 A 12.958 12.958 0 0 0 380.87 28.546 A 15.609 15.609 0 0 0 380.45 28.801 Q 377.122 30.887 374.978 35.243 A 22.927 22.927 0 0 0 374.95 35.301 Q 373.187 38.908 372.87 44.128 A 39.09 39.09 0 0 0 372.8 46.501 L 372.8 70.801 Z M 530 57.501 L 530 29.601 Q 527.3 27.701 524.05 26.551 Q 520.8 25.401 517.2 25.401 A 15.924 15.924 0 0 0 512.229 26.154 A 14.024 14.024 0 0 0 508.75 27.851 A 16.301 16.301 0 0 0 503.731 33.274 A 19.962 19.962 0 0 0 503 34.651 A 20.663 20.663 0 0 0 501.247 40.327 A 27.678 27.678 0 0 0 500.9 44.801 Q 500.9 50.401 503 54.751 A 17.602 17.602 0 0 0 506.106 59.297 A 15.697 15.697 0 0 0 508.8 61.551 Q 512.5 64.001 517.1 64.001 Q 520.9 64.001 524.3 62.151 Q 527.7 60.301 530 57.501 Z M 20.9 38.401 L 9.5 38.401 L 9.5 63.101 Q 14.8 63.701 20.9 63.701 Q 29.8 63.701 34.8 60.501 Q 39.8 57.301 39.8 51.201 A 11.728 11.728 0 0 0 38.928 46.601 Q 37.826 43.988 35.333 42.113 A 14.027 14.027 0 0 0 34.9 41.801 A 16.7 16.7 0 0 0 30.226 39.599 Q 26.303 38.401 20.9 38.401 Z M 9.5 8.201 L 9.5 31.001 L 20.5 31.001 Q 28.4 31.001 33.05 27.701 Q 37.7 24.401 37.7 19.201 A 10.798 10.798 0 0 0 37.026 15.301 Q 35.939 12.471 33.1 10.651 A 16.643 16.643 0 0 0 28.614 8.687 Q 25.125 7.701 20.5 7.701 Q 17.2 7.701 14.5 7.851 Q 11.8 8.001 9.5 8.201 Z M 67.6 41.201 L 96.1 41.201 A 24.355 24.355 0 0 0 95.696 36.615 Q 95.2 34.031 94.096 32.008 A 12.422 12.422 0 0 0 92.3 29.501 A 12.488 12.488 0 0 0 85.339 25.725 A 18.395 18.395 0 0 0 81.8 25.401 A 13.58 13.58 0 0 0 76.688 26.336 A 12.524 12.524 0 0 0 72.2 29.451 Q 68.4 33.501 67.6 41.201 Z M 315 41.201 L 343.5 41.201 A 24.355 24.355 0 0 0 343.096 36.615 Q 342.6 34.031 341.496 32.008 A 12.422 12.422 0 0 0 339.7 29.501 A 12.488 12.488 0 0 0 332.739 25.725 A 18.395 18.395 0 0 0 329.2 25.401 A 13.58 13.58 0 0 0 324.088 26.336 A 12.524 12.524 0 0 0 319.6 29.451 Q 315.8 33.501 315 41.201 Z');
  // ctx.stroke(region);
  ctx.clip(region, "evenodd");
}