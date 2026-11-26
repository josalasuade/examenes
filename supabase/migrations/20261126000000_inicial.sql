-- Esquema inicial — Plataforma de Exámenes (Etapa 1)
--
-- Notas:
-- * La app accede a la base SOLO desde el servidor (API), con el rol dueño de
--   las tablas. El navegador nunca habla con la base.
-- * En Supabase, las tablas del esquema public quedan expuestas por la API REST
--   para los roles anon/authenticated. Por eso se habilita RLS en TODAS las
--   tablas sin definir políticas: nadie puede leerlas por la API REST. El rol
--   dueño (el que usa la app) no está sujeto a RLS.

create table carreras (
  id serial primary key,
  nombre text not null unique,
  activa boolean not null default true
);

create table examenes (
  id uuid primary key default gen_random_uuid(),
  materia text not null,
  docente text not null,
  instancia text not null,
  fecha date not null,
  departamento text not null default 'Departamento de Tecnología Informática - DETIN',
  duracion_min integer not null check (duracion_min > 0 and duracion_min <= 600),
  consignas_generales text not null default '',
  condiciones_aprobacion text not null default '',
  escala jsonb not null,
  codigo_ingreso text not null default '',
  ingreso_hasta timestamptz,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicado', 'cerrado')),
  requiere_seb boolean not null default true,
  seb_config_key text not null default '',
  creado_en timestamptz not null default now()
);

create table temas (
  id uuid primary key default gen_random_uuid(),
  examen_id uuid not null references examenes(id) on delete cascade,
  numero integer not null,
  titulo text not null default '',
  caso_html text not null default '',
  unique (examen_id, numero)
);

create table consignas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references temas(id) on delete cascade,
  orden integer not null,
  parte text,
  titulo text not null,
  enunciado_html text not null default '',
  puntaje numeric(6, 2) not null default 0 check (puntaje >= 0),
  no_suma text not null default '',
  unique (tema_id, orden)
);

create table rubrica_criterios (
  id uuid primary key default gen_random_uuid(),
  consigna_id uuid not null references consignas(id) on delete cascade,
  orden integer not null,
  descripcion text not null,
  puntaje numeric(6, 2) not null default 0 check (puntaje >= 0),
  completo text not null default '',
  parcial text not null default '',
  ausente text not null default ''
);

create table alumnos (
  id uuid primary key default gen_random_uuid(),
  lu text not null unique,
  nombre text not null,
  mail text not null
);

create table asignaciones (
  id uuid primary key default gen_random_uuid(),
  examen_id uuid not null references examenes(id) on delete cascade,
  alumno_id uuid not null references alumnos(id) on delete restrict,
  tema_id uuid not null references temas(id) on delete restrict,
  parte text,
  sin_seb boolean not null default false,
  carrera text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'entregado')),
  iniciado_en timestamptz,
  vence_en timestamptz,
  entregado_en timestamptz,
  entrega_tipo text check (entrega_tipo in ('alumno', 'vencimiento', 'docente')),
  hash_entrega text unique,
  pdf bytea,
  nota_final numeric(5, 2) check (nota_final between 0 and 100),
  observaciones text not null default '',
  unique (examen_id, alumno_id)
);

create table sesiones (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references asignaciones(id) on delete cascade,
  token_hash text not null unique,
  creada_en timestamptz not null default now(),
  revocada_en timestamptz,
  user_agent text not null default ''
);
create index sesiones_asignacion_idx on sesiones(asignacion_id);

create table solicitudes_reingreso (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references asignaciones(id) on delete cascade,
  secreto_hash text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'usada')),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz
);
create index solicitudes_asignacion_idx on solicitudes_reingreso(asignacion_id);

create table respuestas (
  asignacion_id uuid not null references asignaciones(id) on delete cascade,
  consigna_id uuid not null references consignas(id) on delete cascade,
  html text not null default '',
  actualizado_en timestamptz not null default now(),
  primary key (asignacion_id, consigna_id)
);

-- Registro de eventos (append-only): accesos, pegados, salidas de ventana,
-- reingresos, entregas. Es la evidencia que ve el docente.
create table eventos (
  id bigserial primary key,
  asignacion_id uuid not null references asignaciones(id) on delete cascade,
  tipo text not null,
  consigna_id uuid,
  detalle jsonb not null default '{}'::jsonb,
  cliente_ts timestamptz,
  creado_en timestamptz not null default now()
);
create index eventos_asignacion_idx on eventos(asignacion_id, creado_en);

create table envios_mail (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null unique references asignaciones(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'error')),
  intentos integer not null default 0,
  ultimo_error text not null default '',
  enviado_en timestamptz
);

alter table carreras enable row level security;
alter table examenes enable row level security;
alter table temas enable row level security;
alter table consignas enable row level security;
alter table rubrica_criterios enable row level security;
alter table alumnos enable row level security;
alter table asignaciones enable row level security;
alter table sesiones enable row level security;
alter table solicitudes_reingreso enable row level security;
alter table respuestas enable row level security;
alter table eventos enable row level security;
alter table envios_mail enable row level security;
