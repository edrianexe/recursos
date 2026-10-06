/* kit.js — alta en la lista vía formulario público de Kit (sin servidor, sin claves).
   Solo hace falta el ID del formulario (es público: va en cualquier embed de Kit).
   Kit envía el email de confirmación (doble opt-in) y el incentivo configurado en el formulario. */
window.KIT_FORM_ID = "10008572";

window.kitSubscribe = function (email, source, campaign) {
  var body = new URLSearchParams();
  body.append("email_address", email);
  body.append("fields[source]", source || "directo");
  body.append("fields[campaign]", campaign || "stack-ia");
  return fetch("https://app.kit.com/forms/" + window.KIT_FORM_ID + "/subscriptions", {
    method: "POST",
    headers: { "Accept": "application/json" },
    body: body
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (d) {
      var ok = res.ok && (!d.status || d.status === "success" || d.status === "quarantined");
      return { ok: ok, data: d };
    });
  });
};
