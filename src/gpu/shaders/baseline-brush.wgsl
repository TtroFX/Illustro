struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local_position: vec2f,
  @location(1) opacity: f32,
}

@vertex
fn baseline_brush_vertex(
  @builtin(vertex_index) vertex_index: u32,
  @location(0) center_clip: vec2f,
  @location(1) radius_clip: vec2f,
  @location(2) opacity: f32,
) -> VertexOutput {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let local_position = corners[vertex_index];
  var output: VertexOutput;
  output.position = vec4f(center_clip + local_position * radius_clip, 0.0, 1.0);
  output.local_position = local_position;
  output.opacity = opacity;
  return output;
}

@fragment
fn baseline_brush_fragment(input: VertexOutput) -> @location(0) vec4f {
  let radial_distance = length(input.local_position);
  if (radial_distance >= 1.0) {
    discard;
  }
  let coverage = 1.0 - smoothstep(0.85, 1.0, radial_distance);
  let alpha = clamp(input.opacity * coverage, 0.0, 1.0);
  return vec4f(0.0, 0.0, 0.0, alpha);
}
