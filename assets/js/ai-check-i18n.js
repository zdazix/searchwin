// Visitor-facing texts of the free check that scripts put on the page, in English and Spanish.
// The static texts live in the HTML of each language (/ai-check/ and /es/ai-check/); the page
// language is the <html lang> of the page. Server error codes map to the same texts, so a
// Spanish visitor never sees an English server message.

export const DICT = {
  en: {
    'err.invalid_url': 'Enter your website, e.g. yourbusiness.com',
    'err.captcha': "We couldn't confirm you're human. Refresh the page and try again.",
    'err.city_state': 'Enter a US city and state, e.g. Austin, TX',
    'err.city': 'Enter a city, e.g. Manchester',
    'err.country': 'Choose the country of your business',
    'err.service': 'Tell us what you do, e.g. plumber or family dentist',
    'err.expired': 'This check has expired. Run it again, it takes about a minute.',
    'err.answer_failed': "This answer didn't load — it'll be in your full audit.",
    'err.server': 'Something went wrong on our side. Try again in a minute.',
    'err.server_error': 'Something went wrong on our side. Try again in a minute.',
    'err.email_format': 'Enter a valid email, e.g. name@yourbusiness.com',
    'err.email_disposable': "Please use a permanent email address. Temporary inboxes can't receive the audit.",
    'err.email_no_mx': "This email domain can't receive mail. Check it for typos.",
    'err.start': 'We could not start the check. Check your connection and try again.',
    'err.send': 'We could not send your request. Try again.',
    'err.restart': "We couldn't restart the check.",
    'err.retry_later': 'Try again in a minute.',
    'err.generic': 'Something went wrong. Try again.',

    'site.example': 'yourbusiness.com',
    'btn.submit': 'See who ChatGPT picks',
    'btn.starting': 'Starting…',
    'biz.fallback': 'your business',
    'site.fallback': 'your website',
    'recog.in': '{service} in {place}',
    'score.reading': 'Reading your website…',
    'score.asking': 'Asking ChatGPT about {biz}…',
    'score.asking_n': 'Asking ChatGPT about {biz}… {n} of {total} answers in',
    'score.result': '{mentions} of {total} answers name {biz}',

    'notlocal.title': 'This check is built for local businesses',
    'notlocal.text': 'It looks like {site} sells online or across a whole country. The instant check only works for businesses that win customers in their own area. Leave your email and we will audit your online business by hand instead.',
    'country.title': "We can't check this country yet",
    'country.text': "ChatGPT location data isn't available for the country of {site}. Leave your email and we will audit your business by hand instead.",

    'progress.read': 'Reading your website',
    'progress.ask': 'Asking ChatGPT: {prompt}',
    'progress.done': ' done',
    'progress.failed': ' failed',
    'progress.running': ' in progress',

    'failed.title': "We couldn't get ChatGPT's answers this time.",
    'failed.text': 'It happens when ChatGPT is slow to answer. Try again in a moment.',
    'partial.text': "One answer didn't load — it'll be in your full audit.",

    'line.at': 'You appear at #{pos}',
    'line.text_only': "You're mentioned in the answer, but not in ChatGPT's list of businesses",
    'line.miss': 'Not mentioned',
    'card.src': 'ChatGPT / Prompt',
    'card.n': 'Answer {n} of {total}',
    'card.failed_pill': "Didn't load",
    'card.failed_note': "This answer didn't load — it'll be in your full audit.",
    'card.named': 'Businesses ChatGPT named',
    'card.you': 'You',
    'card.rating': 'Rating ',
    'card.reviews': ' reviews',
    'card.none': "ChatGPT didn't list specific businesses in this answer.",
    'card.label': "ChatGPT's answer",
    'card.more': 'Read the full answer',
    'card.less': 'Show less',

    'btn.again': 'Check another website',
    'btn.retry': 'Try again',
    'btn.online': 'Get a free audit for your online business',

    'place.us': 'City, State',
    'place.other': 'City, region (optional)',
    'place.us_ph': 'e.g. Austin, TX',
    'place.other_ph': 'e.g. Manchester',
    'fields.unreadable.title': "We couldn't read this site",
    'fields.unreadable.text': 'Add a few details and we will ask ChatGPT about your business.',
    'fields.missing.title': 'Almost there',
    'fields.missing.both': "We couldn't find what you do or where on your site.",
    'fields.missing.city': 'Your site works across an area. Which city should we ask about?',
    'fields.missing.service': "We couldn't tell what you do from your site.",

    'final.no_comp': 'ChatGPT named no other businesses.',
    'final.no_src': 'No sources were cited.',
    'final.your_site': 'your site',
    'final.legal': 'AI answers change from one question to the next. This check shows what ChatGPT answered on {date}.',
    'comp.one': 'named in {count} of {total} answer',
    'comp.many': 'named in {count} of {total} answers',

    'verdict.not_recommended': 'Not recommended',
    'verdict.sometimes': 'Sometimes recommended',
    'verdict.not_first': 'Recommended, not first',
    'verdict.top_pick': 'Top pick',
    'offer.not_recommended': 'Find out why AI results skip you',
    'offer.sometimes': 'Find out how to show up every time',
    'offer.not_first': 'Find out how to become the first name',
    'offer.top_pick': 'Keep it: see where competitors are catching up',

    'thanks.lead1': "We'll email your AI visibility audit + 45-day roadmap",
    'thanks.for': ' for {name}',
    'thanks.by': ' by ',
    'thanks.lead2': '. Check your inbox (and the spam folder).',
    'thanks.frame': 'Book a free call'
  },

  es: {
    'err.invalid_url': 'Introduce tu web, por ejemplo tunegocio.es',
    'err.captcha': 'No hemos podido confirmar que eres una persona. Recarga la página e inténtalo de nuevo.',
    'err.city_state': 'Introduce una ciudad y un estado de EE. UU., por ejemplo Austin, TX',
    'err.city': 'Introduce una ciudad, por ejemplo Málaga',
    'err.country': 'Elige el país de tu negocio',
    'err.service': 'Dinos a qué te dedicas, por ejemplo fontanero o dentista',
    'err.expired': 'Esta comprobación ha caducado. Vuelve a lanzarla, tarda alrededor de un minuto.',
    'err.answer_failed': 'Esta respuesta no se ha cargado: la incluiremos en tu auditoría completa.',
    'err.server': 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un minuto.',
    'err.server_error': 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un minuto.',
    'err.email_format': 'Introduce un email válido, por ejemplo nombre@tunegocio.es',
    'err.email_disposable': 'Usa una dirección de email permanente. Los buzones temporales no pueden recibir la auditoría.',
    'err.email_no_mx': 'Este dominio de email no puede recibir correo. Revisa que no haya errores.',
    'err.start': 'No hemos podido iniciar la comprobación. Revisa tu conexión e inténtalo de nuevo.',
    'err.send': 'No hemos podido enviar tu solicitud. Inténtalo de nuevo.',
    'err.restart': 'No hemos podido reiniciar la comprobación.',
    'err.retry_later': 'Inténtalo de nuevo en un minuto.',
    'err.generic': 'Algo ha fallado. Inténtalo de nuevo.',

    'site.example': 'tunegocio.es',
    'btn.submit': 'Ver a quién elige ChatGPT',
    'btn.starting': 'Empezando…',
    'biz.fallback': 'tu negocio',
    'site.fallback': 'tu web',
    'recog.in': '{service} en {place}',
    'score.reading': 'Leyendo tu web…',
    'score.asking': 'Preguntando a ChatGPT por {biz}…',
    'score.asking_n': 'Preguntando a ChatGPT por {biz}… {n} de {total} respuestas recibidas',
    'score.result': '{mentions} de {total} respuestas nombran a {biz}',

    'notlocal.title': 'Esta comprobación está pensada para negocios locales',
    'notlocal.text': 'Parece que {site} vende online o en todo un país. La comprobación instantánea solo funciona para negocios que consiguen clientes en su zona. Déjanos tu email y auditaremos tu negocio online a mano.',
    'country.title': 'Todavía no podemos comprobar este país',
    'country.text': 'ChatGPT no ofrece datos de ubicación para el país de {site}. Déjanos tu email y auditaremos tu negocio a mano.',

    'progress.read': 'Leyendo tu web',
    'progress.ask': 'Preguntando a ChatGPT: {prompt}',
    'progress.done': ' hecho',
    'progress.failed': ' con error',
    'progress.running': ' en curso',

    'failed.title': 'Esta vez no hemos podido obtener las respuestas de ChatGPT.',
    'failed.text': 'Ocurre cuando ChatGPT tarda en responder. Inténtalo de nuevo en un momento.',
    'partial.text': 'Una respuesta no se ha cargado: la incluiremos en tu auditoría completa.',

    'line.at': 'Apareces en el puesto n.º {pos}',
    'line.text_only': 'Te menciona en la respuesta, pero no en la lista de negocios de ChatGPT',
    'line.miss': 'No te menciona',
    'card.src': 'ChatGPT / Pregunta',
    'card.n': 'Respuesta {n} de {total}',
    'card.failed_pill': 'No se cargó',
    'card.failed_note': 'Esta respuesta no se ha cargado: la incluiremos en tu auditoría completa.',
    'card.named': 'Negocios que nombró ChatGPT',
    'card.you': 'Tú',
    'card.rating': 'Valoración ',
    'card.reviews': ' reseñas',
    'card.none': 'ChatGPT no ha citado negocios concretos en esta respuesta.',
    'card.label': 'Respuesta de ChatGPT',
    'card.more': 'Leer la respuesta completa',
    'card.less': 'Mostrar menos',

    'btn.again': 'Analizar otra web',
    'btn.retry': 'Reintentar',
    'btn.online': 'Pide una auditoría gratuita para tu negocio online',

    'place.us': 'Ciudad, estado',
    'place.other': 'Ciudad, región (opcional)',
    'place.us_ph': 'p. ej. Austin, TX',
    'place.other_ph': 'p. ej. Málaga',
    'fields.unreadable.title': 'No hemos podido leer esta web',
    'fields.unreadable.text': 'Añade unos datos y preguntaremos a ChatGPT por tu negocio.',
    'fields.missing.title': 'Casi listo',
    'fields.missing.both': 'No hemos encontrado en tu web a qué te dedicas ni dónde.',
    'fields.missing.city': 'Tu web trabaja en una zona amplia. ¿Por qué ciudad preguntamos?',
    'fields.missing.service': 'No hemos podido saber a qué te dedicas a partir de tu web.',

    'final.no_comp': 'ChatGPT no ha nombrado a otros negocios.',
    'final.no_src': 'No ha citado fuentes.',
    'final.your_site': 'tu web',
    'final.legal': 'Las respuestas de la IA cambian de una pregunta a otra. Esta comprobación muestra lo que respondió ChatGPT el {date}.',
    'comp.one': 'nombrado en {count} de {total} respuesta',
    'comp.many': 'nombrado en {count} de {total} respuestas',

    'verdict.not_recommended': 'No recomendado',
    'verdict.sometimes': 'Recomendado a veces',
    'verdict.not_first': 'Recomendado, pero no el primero',
    'verdict.top_pick': 'Primera opción',
    'offer.not_recommended': 'Descubre por qué los resultados de IA te ignoran',
    'offer.sometimes': 'Descubre cómo aparecer siempre',
    'offer.not_first': 'Descubre cómo ser el primer nombre',
    'offer.top_pick': 'Mantén tu posición: mira dónde te alcanzan tus competidores',

    'thanks.lead1': 'Te enviaremos por email tu auditoría de visibilidad en IA + hoja de ruta de 45 días',
    'thanks.for': ' para {name}',
    'thanks.by': ' antes del ',
    'thanks.lead2': '. Revisa tu bandeja de entrada (y la carpeta de spam).',
    'thanks.frame': 'Reservar una llamada gratuita'
  }
};

export const LOCALES = { en: 'en-US', es: 'es-ES' };
/** Where each language's check lives (the "check another website" link and the thank-you redirect). */
export const PATHS = { en: '/ai-check/', es: '/es/ai-check/' };
export const THANKS_PATHS = { en: '/ai-check/thank-you/', es: '/es/ai-check/thank-you/' };

export function pageLang() {
  const l = typeof document !== 'undefined' ? (document.documentElement.getAttribute('lang') || 'en') : 'en';
  return String(l).slice(0, 2).toLowerCase() === 'es' ? 'es' : 'en';
}

/** A translator for one language; falls back to English for a missing key. */
export function translator(lang) {
  const dict = DICT[lang] || DICT.en;
  const has = (key) => Object.prototype.hasOwnProperty.call(dict, key);
  const t = (key, vars) => {
    const s = has(key) ? dict[key] : DICT.en[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k]))) : s;
  };
  t.has = has;
  return t;
}

export const LANG = pageLang();
export const t = translator(LANG);
export const locale = LOCALES[LANG];

export const fmtDate = (d) => (d ? new Date(d) : new Date()).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtWhen = (d) => d.toLocaleDateString(locale, { weekday: 'long', month: LANG === 'es' ? 'long' : 'short', day: 'numeric' });
export const fmtRating = (n) => Number(n).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtCount = (n) => Number(n).toLocaleString(locale);
