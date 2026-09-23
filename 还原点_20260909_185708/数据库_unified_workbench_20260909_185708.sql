--
-- PostgreSQL database dump
--

\restrict j0cVIRpGaFxHEs0D8fZJZBEbycjMRxrVTbyuxBu3vWg7Pcd8KLCEXLQxuj6QexN

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.vote_record DROP CONSTRAINT IF EXISTS vote_record_vote_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vote_record DROP CONSTRAINT IF EXISTS vote_record_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vote DROP CONSTRAINT IF EXISTS vote_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_webauthn_credential DROP CONSTRAINT IF EXISTS user_webauthn_credential_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_totp DROP CONSTRAINT IF EXISTS user_totp_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_tag DROP CONSTRAINT IF EXISTS user_tag_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_tag DROP CONSTRAINT IF EXISTS user_tag_tag_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_session DROP CONSTRAINT IF EXISTS user_session_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_recovery_code DROP CONSTRAINT IF EXISTS user_recovery_code_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notification_config DROP CONSTRAINT IF EXISTS user_notification_config_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.topology DROP CONSTRAINT IF EXISTS topology_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.template DROP CONSTRAINT IF EXISTS template_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task DROP CONSTRAINT IF EXISTS task_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task DROP CONSTRAINT IF EXISTS task_assigned_to_fkey;
ALTER TABLE IF EXISTS ONLY public.systems DROP CONSTRAINT IF EXISTS systems_server_id_fkey;
ALTER TABLE IF EXISTS ONLY public.systems DROP CONSTRAINT IF EXISTS systems_parent_system_id_fkey;
ALTER TABLE IF EXISTS ONLY public.subscription DROP CONSTRAINT IF EXISTS subscription_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stream_room DROP CONSTRAINT IF EXISTS stream_room_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.services DROP CONSTRAINT IF EXISTS services_system_id_fkey;
ALTER TABLE IF EXISTS ONLY public.servers DROP CONSTRAINT IF EXISTS servers_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.secret DROP CONSTRAINT IF EXISTS secret_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.secret_category DROP CONSTRAINT IF EXISTS secret_category_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.secret DROP CONSTRAINT IF EXISTS secret_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reminder DROP CONSTRAINT IF EXISTS reminder_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_proposal_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_meeting_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_assignee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal DROP CONSTRAINT IF EXISTS project_proposal_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal DROP CONSTRAINT IF EXISTS project_proposal_meeting_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal DROP CONSTRAINT IF EXISTS project_proposal_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal_comment DROP CONSTRAINT IF EXISTS project_proposal_comment_proposal_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal_comment DROP CONSTRAINT IF EXISTS project_proposal_comment_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal DROP CONSTRAINT IF EXISTS project_proposal_assignee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project DROP CONSTRAINT IF EXISTS project_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_member DROP CONSTRAINT IF EXISTS project_member_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_member DROP CONSTRAINT IF EXISTS project_member_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_meeting DROP CONSTRAINT IF EXISTS project_meeting_todo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_meeting DROP CONSTRAINT IF EXISTS project_meeting_proposal_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_meeting DROP CONSTRAINT IF EXISTS project_meeting_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_event DROP CONSTRAINT IF EXISTS project_event_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_event DROP CONSTRAINT IF EXISTS project_event_operator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_change DROP CONSTRAINT IF EXISTS project_change_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notification DROP CONSTRAINT IF EXISTS notification_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.note DROP CONSTRAINT IF EXISTS note_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.form_response DROP CONSTRAINT IF EXISTS form_response_respondent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.form_response DROP CONSTRAINT IF EXISTS form_response_form_id_fkey;
ALTER TABLE IF EXISTS ONLY public.form DROP CONSTRAINT IF EXISTS form_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.note DROP CONSTRAINT IF EXISTS fk_note_parent;
ALTER TABLE IF EXISTS ONLY public.file_shares DROP CONSTRAINT IF EXISTS file_shares_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.content DROP CONSTRAINT IF EXISTS content_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contact DROP CONSTRAINT IF EXISTS contact_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.calendar_event DROP CONSTRAINT IF EXISTS calendar_event_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.budget DROP CONSTRAINT IF EXISTS budget_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.announcement DROP CONSTRAINT IF EXISTS announcement_owner_id_fkey;
DROP INDEX IF EXISTS public.ix_user_username;
DROP INDEX IF EXISTS public.ix_project_proposal_comment_proposal_id;
DROP INDEX IF EXISTS public.ix_file_shares_share_code;
ALTER TABLE IF EXISTS ONLY public.vote_record DROP CONSTRAINT IF EXISTS vote_record_pkey;
ALTER TABLE IF EXISTS ONLY public.vote DROP CONSTRAINT IF EXISTS vote_pkey;
ALTER TABLE IF EXISTS ONLY public.user_webauthn_credential DROP CONSTRAINT IF EXISTS user_webauthn_credential_pkey;
ALTER TABLE IF EXISTS ONLY public.user_webauthn_credential DROP CONSTRAINT IF EXISTS user_webauthn_credential_credential_id_key;
ALTER TABLE IF EXISTS ONLY public.user_totp DROP CONSTRAINT IF EXISTS user_totp_pkey;
ALTER TABLE IF EXISTS ONLY public.user_tag DROP CONSTRAINT IF EXISTS user_tag_pkey;
ALTER TABLE IF EXISTS ONLY public.user_session DROP CONSTRAINT IF EXISTS user_session_pkey;
ALTER TABLE IF EXISTS ONLY public.user_session DROP CONSTRAINT IF EXISTS user_session_jti_key;
ALTER TABLE IF EXISTS ONLY public.user_recovery_code DROP CONSTRAINT IF EXISTS user_recovery_code_pkey;
ALTER TABLE IF EXISTS ONLY public."user" DROP CONSTRAINT IF EXISTS user_pkey;
ALTER TABLE IF EXISTS ONLY public.user_notification_config DROP CONSTRAINT IF EXISTS user_notification_config_user_id_key;
ALTER TABLE IF EXISTS ONLY public.user_notification_config DROP CONSTRAINT IF EXISTS user_notification_config_pkey;
ALTER TABLE IF EXISTS ONLY public."user" DROP CONSTRAINT IF EXISTS user_email_key;
ALTER TABLE IF EXISTS ONLY public.project_member DROP CONSTRAINT IF EXISTS uq_project_member_project_user;
ALTER TABLE IF EXISTS ONLY public.topology DROP CONSTRAINT IF EXISTS topology_pkey;
ALTER TABLE IF EXISTS ONLY public.template DROP CONSTRAINT IF EXISTS template_pkey;
ALTER TABLE IF EXISTS ONLY public.task DROP CONSTRAINT IF EXISTS task_pkey;
ALTER TABLE IF EXISTS ONLY public.tag DROP CONSTRAINT IF EXISTS tag_pkey;
ALTER TABLE IF EXISTS ONLY public.tag DROP CONSTRAINT IF EXISTS tag_name_key;
ALTER TABLE IF EXISTS ONLY public.systems DROP CONSTRAINT IF EXISTS systems_pkey;
ALTER TABLE IF EXISTS ONLY public.system_config DROP CONSTRAINT IF EXISTS system_config_pkey;
ALTER TABLE IF EXISTS ONLY public.subscription DROP CONSTRAINT IF EXISTS subscription_pkey;
ALTER TABLE IF EXISTS ONLY public.stream_room DROP CONSTRAINT IF EXISTS stream_room_pkey;
ALTER TABLE IF EXISTS ONLY public.services DROP CONSTRAINT IF EXISTS services_pkey;
ALTER TABLE IF EXISTS ONLY public.servers DROP CONSTRAINT IF EXISTS servers_pkey;
ALTER TABLE IF EXISTS ONLY public.secret DROP CONSTRAINT IF EXISTS secret_pkey;
ALTER TABLE IF EXISTS ONLY public.secret_category DROP CONSTRAINT IF EXISTS secret_category_pkey;
ALTER TABLE IF EXISTS ONLY public.reminder DROP CONSTRAINT IF EXISTS reminder_pkey;
ALTER TABLE IF EXISTS ONLY public.project_todo DROP CONSTRAINT IF EXISTS project_todo_pkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal DROP CONSTRAINT IF EXISTS project_proposal_pkey;
ALTER TABLE IF EXISTS ONLY public.project_proposal_comment DROP CONSTRAINT IF EXISTS project_proposal_comment_pkey;
ALTER TABLE IF EXISTS ONLY public.project DROP CONSTRAINT IF EXISTS project_pkey;
ALTER TABLE IF EXISTS ONLY public.project_member DROP CONSTRAINT IF EXISTS project_member_pkey;
ALTER TABLE IF EXISTS ONLY public.project_meeting DROP CONSTRAINT IF EXISTS project_meeting_pkey;
ALTER TABLE IF EXISTS ONLY public.project_event DROP CONSTRAINT IF EXISTS project_event_pkey;
ALTER TABLE IF EXISTS ONLY public.project_change DROP CONSTRAINT IF EXISTS project_change_pkey;
ALTER TABLE IF EXISTS ONLY public.notification DROP CONSTRAINT IF EXISTS notification_pkey;
ALTER TABLE IF EXISTS ONLY public.note DROP CONSTRAINT IF EXISTS note_pkey;
ALTER TABLE IF EXISTS ONLY public.link_relation DROP CONSTRAINT IF EXISTS link_relation_pkey;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_pkey;
ALTER TABLE IF EXISTS ONLY public.form_response DROP CONSTRAINT IF EXISTS form_response_pkey;
ALTER TABLE IF EXISTS ONLY public.form DROP CONSTRAINT IF EXISTS form_pkey;
ALTER TABLE IF EXISTS ONLY public.file_shares DROP CONSTRAINT IF EXISTS file_shares_pkey;
ALTER TABLE IF EXISTS ONLY public.content DROP CONSTRAINT IF EXISTS content_pkey;
ALTER TABLE IF EXISTS ONLY public.contact DROP CONSTRAINT IF EXISTS contact_pkey;
ALTER TABLE IF EXISTS ONLY public.calendar_event DROP CONSTRAINT IF EXISTS calendar_event_pkey;
ALTER TABLE IF EXISTS ONLY public.budget DROP CONSTRAINT IF EXISTS budget_pkey;
ALTER TABLE IF EXISTS ONLY public.announcement DROP CONSTRAINT IF EXISTS announcement_pkey;
DROP TABLE IF EXISTS public.vote_record;
DROP TABLE IF EXISTS public.vote;
DROP TABLE IF EXISTS public.user_webauthn_credential;
DROP TABLE IF EXISTS public.user_totp;
DROP TABLE IF EXISTS public.user_tag;
DROP TABLE IF EXISTS public.user_session;
DROP TABLE IF EXISTS public.user_recovery_code;
DROP TABLE IF EXISTS public.user_notification_config;
DROP TABLE IF EXISTS public."user";
DROP TABLE IF EXISTS public.topology;
DROP TABLE IF EXISTS public.template;
DROP TABLE IF EXISTS public.task;
DROP TABLE IF EXISTS public.tag;
DROP TABLE IF EXISTS public.systems;
DROP TABLE IF EXISTS public.system_config;
DROP TABLE IF EXISTS public.subscription;
DROP TABLE IF EXISTS public.stream_room;
DROP TABLE IF EXISTS public.services;
DROP TABLE IF EXISTS public.servers;
DROP TABLE IF EXISTS public.secret_category;
DROP TABLE IF EXISTS public.secret;
DROP TABLE IF EXISTS public.reminder;
DROP TABLE IF EXISTS public.project_todo;
DROP TABLE IF EXISTS public.project_proposal_comment;
DROP TABLE IF EXISTS public.project_proposal;
DROP TABLE IF EXISTS public.project_member;
DROP TABLE IF EXISTS public.project_meeting;
DROP TABLE IF EXISTS public.project_event;
DROP TABLE IF EXISTS public.project_change;
DROP TABLE IF EXISTS public.project;
DROP TABLE IF EXISTS public.notification;
DROP TABLE IF EXISTS public.note;
DROP TABLE IF EXISTS public.link_relation;
DROP TABLE IF EXISTS public.inventory;
DROP TABLE IF EXISTS public.form_response;
DROP TABLE IF EXISTS public.form;
DROP TABLE IF EXISTS public.file_shares;
DROP TABLE IF EXISTS public.content;
DROP TABLE IF EXISTS public.contact;
DROP TABLE IF EXISTS public.calendar_event;
DROP TABLE IF EXISTS public.budget;
DROP TABLE IF EXISTS public.announcement;
DROP TYPE IF EXISTS public.votestatus;
DROP TYPE IF EXISTS public.userstatus;
DROP TYPE IF EXISTS public.userrole;
DROP TYPE IF EXISTS public.taskstatus;
DROP TYPE IF EXISTS public.taskpriority;
DROP TYPE IF EXISTS public.subscriptionstatus;
DROP TYPE IF EXISTS public.streamroomtype;
DROP TYPE IF EXISTS public.streamroommode;
DROP TYPE IF EXISTS public.eventrepeat;
DROP TYPE IF EXISTS public.contacttype;
DROP TYPE IF EXISTS public.budgetstatus;
DROP TYPE IF EXISTS public.budgetperiod;
DROP TYPE IF EXISTS public.billingcycle;
--
-- Name: billingcycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billingcycle AS ENUM (
    'MONTHLY',
    'YEARLY'
);


--
-- Name: budgetperiod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budgetperiod AS ENUM (
    'MONTHLY',
    'QUARTERLY',
    'YEARLY'
);


--
-- Name: budgetstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budgetstatus AS ENUM (
    'ACTIVE',
    'EXCEEDED',
    'COMPLETED'
);


--
-- Name: contacttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contacttype AS ENUM (
    'CUSTOMER',
    'SUPPLIER',
    'PARTNER',
    'OTHER'
);


--
-- Name: eventrepeat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.eventrepeat AS ENUM (
    'NONE',
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY'
);


--
-- Name: streamroommode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.streamroommode AS ENUM (
    'BUILTIN',
    'EXTERNAL'
);


--
-- Name: streamroomtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.streamroomtype AS ENUM (
    'TEMPORARY',
    'PERMANENT'
);


--
-- Name: subscriptionstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscriptionstatus AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'PAUSED'
);


--
-- Name: taskpriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.taskpriority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: taskstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.taskstatus AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'ADMIN',
    'MEMBER'
);


--
-- Name: userstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userstatus AS ENUM (
    'ACTIVE',
    'DISABLED'
);


--
-- Name: votestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.votestatus AS ENUM (
    'ACTIVE',
    'CLOSED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    is_pinned boolean NOT NULL,
    is_published boolean NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: budget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    amount double precision NOT NULL,
    spent double precision NOT NULL,
    period public.budgetperiod NOT NULL,
    status public.budgetstatus NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    all_day boolean NOT NULL,
    location character varying(200),
    repeat public.eventrepeat NOT NULL,
    color character varying(20),
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    reminder_enabled boolean NOT NULL,
    reminder_minutes integer NOT NULL,
    reminded boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    company character varying(200),
    email character varying(200),
    phone character varying(50),
    address text,
    contact_type character varying(100) DEFAULT 'customer'::character varying NOT NULL,
    tags jsonb,
    notes text,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    body jsonb NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) NOT NULL,
    restricted_users jsonb,
    restricted_tags jsonb,
    tags jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: file_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_shares (
    id uuid NOT NULL,
    original_name character varying(255) NOT NULL,
    stored_name character varying(255) NOT NULL,
    file_path character varying(512) NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(255),
    share_code character varying(12) NOT NULL,
    password_hash character varying(255),
    expires_at timestamp without time zone NOT NULL,
    max_downloads integer,
    download_count integer NOT NULL,
    is_deleted boolean NOT NULL,
    deleted_at timestamp without time zone,
    owner_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    fields jsonb NOT NULL,
    is_active boolean NOT NULL,
    allow_anonymous boolean NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) NOT NULL,
    restricted_users jsonb,
    restricted_tags jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_response; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_response (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    respondent_id uuid,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    quantity integer NOT NULL,
    location character varying(200),
    description character varying(1000),
    status character varying(20) NOT NULL,
    tags jsonb,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN inventory.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.name IS '物品名称';


--
-- Name: COLUMN inventory.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.category IS '物品分类';


--
-- Name: COLUMN inventory.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.quantity IS '数量';


--
-- Name: COLUMN inventory.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.location IS '存放位置';


--
-- Name: COLUMN inventory.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.description IS '描述';


--
-- Name: COLUMN inventory.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.status IS '状态: available/in_use/maintenance/retired';


--
-- Name: COLUMN inventory.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.tags IS '标签';


--
-- Name: link_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_relation (
    id uuid NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id uuid NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN link_relation.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.link_relation.source_type IS '源对象类型';


--
-- Name: COLUMN link_relation.source_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.link_relation.source_id IS '源对象ID';


--
-- Name: COLUMN link_relation.target_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.link_relation.target_type IS '目标对象类型';


--
-- Name: COLUMN link_relation.target_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.link_relation.target_id IS '目标对象ID';


--
-- Name: note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    content text,
    category character varying(100),
    tags jsonb,
    is_pinned boolean NOT NULL,
    parent_id uuid,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    read boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id uuid NOT NULL,
    number character varying(50),
    title character varying(200) NOT NULL,
    description text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    restricted_tags jsonb,
    member_ids jsonb,
    member_permissions jsonb,
    department character varying(50),
    language character varying(30),
    is_open_source boolean DEFAULT false NOT NULL,
    priority character varying(20) DEFAULT '待定'::character varying NOT NULL,
    project_type character varying(30),
    goals text,
    requirements text,
    additional_req text,
    modules text,
    related_projects text,
    dev_process text,
    repo_url character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    status_log jsonb
);


--
-- Name: COLUMN project.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.number IS '项目编号';


--
-- Name: COLUMN project.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.title IS '项目名称';


--
-- Name: COLUMN project.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.description IS '项目描述';


--
-- Name: COLUMN project.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.content IS 'Tiptap JSON 格式文档内容';


--
-- Name: COLUMN project.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.status IS '状态: draft/ongoing/done/archived';


--
-- Name: COLUMN project.owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.owner_id IS '创建者ID';


--
-- Name: COLUMN project.member_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.member_permissions IS '成员权限配置';


--
-- Name: COLUMN project.department; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.department IS '所属团队/部门';


--
-- Name: COLUMN project.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.language IS '项目语言';


--
-- Name: COLUMN project.is_open_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.is_open_source IS '是否开源';


--
-- Name: COLUMN project.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.priority IS '项目优先级: 立即/重要/一般/最后/待定';


--
-- Name: COLUMN project.project_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.project_type IS '项目类型: 六类+其他';


--
-- Name: COLUMN project.goals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.goals IS '项目目标';


--
-- Name: COLUMN project.requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.requirements IS '项目需求';


--
-- Name: COLUMN project.additional_req; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.additional_req IS '附加需求';


--
-- Name: COLUMN project.modules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.modules IS '模块划分';


--
-- Name: COLUMN project.related_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.related_projects IS '关联项目';


--
-- Name: COLUMN project.dev_process; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.dev_process IS '开发流程';


--
-- Name: COLUMN project.repo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.repo_url IS '开源仓库地址';


--
-- Name: COLUMN project.status_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project.status_log IS '状态变更记录';


--
-- Name: project_change; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_change (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    date timestamp with time zone NOT NULL,
    category_major character varying(50) NOT NULL,
    category_minor character varying(50),
    category_detail character varying(200),
    content text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN project_change.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.project_id IS '所属项目ID';


--
-- Name: COLUMN project_change.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.number IS '变更编号';


--
-- Name: COLUMN project_change.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.title IS '变更标题';


--
-- Name: COLUMN project_change.date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.date IS '变更日期';


--
-- Name: COLUMN project_change.category_major; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.category_major IS '变更大类';


--
-- Name: COLUMN project_change.category_minor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.category_minor IS '变更小类';


--
-- Name: COLUMN project_change.category_detail; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.category_detail IS '变更明细分类';


--
-- Name: COLUMN project_change.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.content IS '变更内容';


--
-- Name: COLUMN project_change.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_change.status IS '状态: pending/approved/rejected';


--
-- Name: project_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_event (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    event_type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    details jsonb NOT NULL,
    operator_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN project_event.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.project_id IS '所属项目ID';


--
-- Name: COLUMN project_event.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.number IS '事件编号';


--
-- Name: COLUMN project_event.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.event_type IS '事件类型';


--
-- Name: COLUMN project_event.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.title IS '事件标题';


--
-- Name: COLUMN project_event.details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.details IS '事件详情';


--
-- Name: COLUMN project_event.operator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_event.operator_id IS '操作者ID';


--
-- Name: project_meeting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_meeting (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    speaker character varying(100),
    participants jsonb NOT NULL,
    content text,
    notes jsonb NOT NULL,
    proposal_id uuid,
    todo_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title character varying(500)
);


--
-- Name: COLUMN project_meeting.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.project_id IS '所属项目ID';


--
-- Name: COLUMN project_meeting.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.number IS '会议编号';


--
-- Name: COLUMN project_meeting.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.type IS '会议类型';


--
-- Name: COLUMN project_meeting.started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.started_at IS '会议开始时间';


--
-- Name: COLUMN project_meeting.speaker; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.speaker IS '主讲人';


--
-- Name: COLUMN project_meeting.participants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.participants IS '参会人列表';


--
-- Name: COLUMN project_meeting.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.content IS '会议内容';


--
-- Name: COLUMN project_meeting.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.notes IS '会议记录列表';


--
-- Name: COLUMN project_meeting.proposal_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.proposal_id IS '关联提案ID';


--
-- Name: COLUMN project_meeting.todo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_meeting.todo_id IS '关联待办ID';


--
-- Name: project_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_member (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_title character varying(100),
    notes text,
    is_owner boolean NOT NULL,
    is_active boolean NOT NULL,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN project_member.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.project_id IS '所属项目ID';


--
-- Name: COLUMN project_member.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.user_id IS '成员用户ID';


--
-- Name: COLUMN project_member.role_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.role_title IS '角色名称';


--
-- Name: COLUMN project_member.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.notes IS '备注';


--
-- Name: COLUMN project_member.is_owner; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.is_owner IS '是否项目负责人';


--
-- Name: COLUMN project_member.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.is_active IS '是否在职';


--
-- Name: COLUMN project_member.joined_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.joined_at IS '加入时间';


--
-- Name: COLUMN project_member.left_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_member.left_at IS '离开时间';


--
-- Name: project_proposal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_proposal (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    type character varying(50) DEFAULT 'feature'::character varying NOT NULL,
    priority character varying(10) DEFAULT 'P2'::character varying NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reject_reason text,
    attachment_links jsonb NOT NULL,
    creator_id uuid NOT NULL,
    assignee_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meeting_id uuid
);


--
-- Name: COLUMN project_proposal.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.project_id IS '所属项目ID';


--
-- Name: COLUMN project_proposal.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.number IS '提案编号';


--
-- Name: COLUMN project_proposal.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.title IS '提案标题';


--
-- Name: COLUMN project_proposal.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.type IS '提案类型: feature/bug/idea';


--
-- Name: COLUMN project_proposal.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.priority IS '优先级: P0/P1/P2/P3';


--
-- Name: COLUMN project_proposal.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.description IS '提案描述';


--
-- Name: COLUMN project_proposal.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.status IS '状态: pending/approved/in_progress/completed/rejected';


--
-- Name: COLUMN project_proposal.reject_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.reject_reason IS '驳回原因';


--
-- Name: COLUMN project_proposal.attachment_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.attachment_links IS '附件链接列表';


--
-- Name: COLUMN project_proposal.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.creator_id IS '创建者ID';


--
-- Name: COLUMN project_proposal.assignee_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal.assignee_id IS '负责人ID';


--
-- Name: project_proposal_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_proposal_comment (
    id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN project_proposal_comment.proposal_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal_comment.proposal_id IS '所属提案ID';


--
-- Name: COLUMN project_proposal_comment.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal_comment.creator_id IS '创建者ID';


--
-- Name: COLUMN project_proposal_comment.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_proposal_comment.content IS '评论内容';


--
-- Name: project_todo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_todo (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    priority character varying(10) DEFAULT 'P2'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    assignee_id uuid,
    creator_id uuid NOT NULL,
    proposal_id uuid,
    due_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meeting_id uuid
);


--
-- Name: COLUMN project_todo.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.project_id IS '所属项目ID';


--
-- Name: COLUMN project_todo.number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.number IS '待办编号';


--
-- Name: COLUMN project_todo.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.title IS '待办标题';


--
-- Name: COLUMN project_todo.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.description IS '待办描述';


--
-- Name: COLUMN project_todo.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.priority IS '优先级: P0/P1/P2/P3';


--
-- Name: COLUMN project_todo.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.status IS '状态: pending/doing/done/cancelled';


--
-- Name: COLUMN project_todo.assignee_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.assignee_id IS '负责人ID';


--
-- Name: COLUMN project_todo.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.creator_id IS '创建者ID';


--
-- Name: COLUMN project_todo.proposal_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.proposal_id IS '关联提案ID';


--
-- Name: COLUMN project_todo.due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_todo.due_date IS '截止时间';


--
-- Name: reminder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminder (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    content text,
    trigger_time timestamp with time zone,
    target_users jsonb,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    creator_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN reminder.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.title IS '提醒标题';


--
-- Name: COLUMN reminder.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.content IS '提醒内容';


--
-- Name: COLUMN reminder.trigger_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.trigger_time IS '触发时间';


--
-- Name: COLUMN reminder.target_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.target_users IS '目标用户列表';


--
-- Name: COLUMN reminder.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.status IS '提醒状态';


--
-- Name: COLUMN reminder.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.creator_id IS '创建者 ID';


--
-- Name: COLUMN reminder.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminder.created_at IS '创建时间';


--
-- Name: secret; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secret (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    secret_type character varying(20) DEFAULT 'other'::character varying NOT NULL,
    category_id uuid,
    sub_category character varying(100) DEFAULT ''::character varying NOT NULL,
    encrypted_data bytea NOT NULL,
    note character varying(500) DEFAULT ''::character varying NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN secret.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.name IS '名称';


--
-- Name: COLUMN secret.secret_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.secret_type IS 'api_key/account/config/other';


--
-- Name: COLUMN secret.category_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.category_id IS '所属分类';


--
-- Name: COLUMN secret.sub_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.sub_category IS '子分类（如 OpenAI、Claude 等）';


--
-- Name: COLUMN secret.encrypted_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.encrypted_data IS 'AES-256-GCM 加密数据';


--
-- Name: COLUMN secret.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret.note IS '备注（明文）';


--
-- Name: secret_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secret_category (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500) DEFAULT ''::character varying NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN secret_category.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_category.name IS '分类名称';


--
-- Name: COLUMN secret_category.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_category.description IS '分类描述';


--
-- Name: servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servers (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    hostname character varying(200),
    purpose character varying(500),
    location character varying(200),
    ip character varying(45),
    os character varying(100),
    cpu_cores integer,
    ram_capacity integer,
    ram_unit character varying(10) DEFAULT 'GB'::character varying NOT NULL,
    disk_capacity integer,
    disk_unit character varying(10) DEFAULT 'GB'::character varying NOT NULL,
    hardware_specs jsonb NOT NULL,
    model character varying(200),
    serial_number character varying(100),
    tags jsonb NOT NULL,
    description text,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    owner_id uuid NOT NULL,
    maintainer_ids jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN servers.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.name IS '服务器名称';


--
-- Name: COLUMN servers.hostname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.hostname IS '主机名';


--
-- Name: COLUMN servers.purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.purpose IS '用途';


--
-- Name: COLUMN servers.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.location IS '物理位置';


--
-- Name: COLUMN servers.ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.ip IS 'IP 地址';


--
-- Name: COLUMN servers.os; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.os IS '操作系统';


--
-- Name: COLUMN servers.cpu_cores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.cpu_cores IS 'CPU 核心数';


--
-- Name: COLUMN servers.ram_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.ram_capacity IS '内存容量';


--
-- Name: COLUMN servers.ram_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.ram_unit IS '内存单位: KB/MB/GB/TB';


--
-- Name: COLUMN servers.disk_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.disk_capacity IS '磁盘容量';


--
-- Name: COLUMN servers.disk_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.disk_unit IS '磁盘单位: KB/MB/GB/TB';


--
-- Name: COLUMN servers.hardware_specs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.hardware_specs IS '硬件配置清单';


--
-- Name: COLUMN servers.model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.model IS '型号';


--
-- Name: COLUMN servers.serial_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.serial_number IS '序列号';


--
-- Name: COLUMN servers.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.tags IS '标签列表';


--
-- Name: COLUMN servers.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.description IS '描述';


--
-- Name: COLUMN servers.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.notes IS '备注';


--
-- Name: COLUMN servers.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.status IS '状态: active/maintenance/offline';


--
-- Name: COLUMN servers.maintainer_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.maintainer_ids IS '维护者 UUID 列表';


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    system_id uuid NOT NULL,
    protocol character varying(10) DEFAULT 'tcp'::character varying NOT NULL,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    health_check_url character varying(500),
    target_type character varying(20),
    target_name character varying(200),
    port integer,
    maintainer_ids jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN services.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.name IS '服务名称';


--
-- Name: COLUMN services.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.description IS '描述';


--
-- Name: COLUMN services.protocol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.protocol IS '协议: tcp/udp/http/https';


--
-- Name: COLUMN services.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.status IS '状态: running/stopped/error';


--
-- Name: COLUMN services.health_check_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.health_check_url IS '健康检查 URL';


--
-- Name: COLUMN services.target_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.target_type IS '目标类型';


--
-- Name: COLUMN services.target_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.target_name IS '目标名称';


--
-- Name: COLUMN services.port; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.port IS '服务端口';


--
-- Name: COLUMN services.maintainer_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.maintainer_ids IS '维护者 UUID 列表';


--
-- Name: stream_room; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_room (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    creator_id uuid NOT NULL,
    mode public.streamroommode NOT NULL,
    room_type public.streamroomtype NOT NULL,
    config jsonb,
    is_open boolean NOT NULL,
    is_active boolean NOT NULL,
    pusher_id uuid,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN stream_room.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.name IS '房间名称';


--
-- Name: COLUMN stream_room.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.creator_id IS '创建者';


--
-- Name: COLUMN stream_room.mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.mode IS '推流模式: builtin(内置WHIP) / external(外部RTMP)';


--
-- Name: COLUMN stream_room.room_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.room_type IS '房间类型: temporary(临时) / permanent(常驻)';


--
-- Name: COLUMN stream_room.config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.config IS 'per-room 配置(bitrate/resolution/fps/audio)';


--
-- Name: COLUMN stream_room.is_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.is_open IS '是否开放访问';


--
-- Name: COLUMN stream_room.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.is_active IS '当前是否有人推流';


--
-- Name: COLUMN stream_room.pusher_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.pusher_id IS '当前推流者 user_id';


--
-- Name: COLUMN stream_room.last_active_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.last_active_at IS '最后活跃时间';


--
-- Name: COLUMN stream_room.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stream_room.created_at IS '创建时间';


--
-- Name: subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    provider character varying(100) NOT NULL,
    amount double precision NOT NULL,
    billing_cycle public.billingcycle NOT NULL,
    next_billing timestamp without time zone,
    status public.subscriptionstatus NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL
);


--
-- Name: COLUMN system_config.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_config.key IS '配置键';


--
-- Name: COLUMN system_config.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_config.value IS '配置值';


--
-- Name: systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systems (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    server_id uuid NOT NULL,
    parent_system_id uuid,
    ip character varying(45),
    os_type character varying(50),
    os_version character varying(100),
    cpu_allocated integer,
    ram_allocated integer,
    disk_allocated integer,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    environment character varying(20) DEFAULT 'production'::character varying NOT NULL,
    tags jsonb NOT NULL,
    notes character varying(1000),
    maintainer_ids jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN systems.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.name IS '系统名称';


--
-- Name: COLUMN systems.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.description IS '描述';


--
-- Name: COLUMN systems.parent_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.parent_system_id IS '父系统 ID（非空表示 VM，深度=1）';


--
-- Name: COLUMN systems.ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.ip IS 'IP 地址';


--
-- Name: COLUMN systems.os_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.os_type IS '操作系统类型';


--
-- Name: COLUMN systems.os_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.os_version IS '操作系统版本';


--
-- Name: COLUMN systems.cpu_allocated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.cpu_allocated IS '分配 CPU 核心数';


--
-- Name: COLUMN systems.ram_allocated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.ram_allocated IS '分配内存 GB';


--
-- Name: COLUMN systems.disk_allocated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.disk_allocated IS '分配磁盘 GB';


--
-- Name: COLUMN systems.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.status IS '状态: running/stopped/paused/error';


--
-- Name: COLUMN systems.environment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.environment IS '环境: production/staging/development/testing';


--
-- Name: COLUMN systems.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.tags IS '标签列表';


--
-- Name: COLUMN systems.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.notes IS '备注';


--
-- Name: COLUMN systems.maintainer_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.systems.maintainer_ids IS '维护者 UUID 列表';


--
-- Name: tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(20),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    status public.taskstatus NOT NULL,
    priority public.taskpriority NOT NULL,
    due_date timestamp without time zone,
    assigned_to uuid,
    owner_id uuid NOT NULL,
    tags jsonb,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) DEFAULT '默认'::character varying NOT NULL,
    location character varying(20) DEFAULT 'global'::character varying NOT NULL,
    schema jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    restricted_users jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN template.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template.name IS '模板名称';


--
-- Name: COLUMN template.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template.category IS '分类';


--
-- Name: COLUMN template.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template.location IS '模板位置: project/record/global';


--
-- Name: COLUMN template.schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template.schema IS '字段定义数组';


--
-- Name: COLUMN template.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template.version IS '版本号';


--
-- Name: topology; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topology (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    nodes jsonb NOT NULL,
    edges jsonb NOT NULL,
    owner_id uuid NOT NULL,
    visibility character varying(20) NOT NULL,
    restricted_users jsonb,
    restricted_tags jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN topology.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topology.name IS '拓扑名称';


--
-- Name: COLUMN topology.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topology.description IS '描述';


--
-- Name: COLUMN topology.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topology.category IS '用户自定义分类标签';


--
-- Name: COLUMN topology.nodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topology.nodes IS '节点列表';


--
-- Name: COLUMN topology.edges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topology.edges IS '连线列表';


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id uuid NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(128) NOT NULL,
    nickname character varying(50) NOT NULL,
    email character varying(200),
    phone character varying(30),
    gender character varying(10),
    avatar text,
    role public.userrole NOT NULL,
    status public.userstatus NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    preferences jsonb
);


--
-- Name: user_notification_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notification_config (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    enabled_channels jsonb NOT NULL,
    feishu_webhook_url character varying(500),
    wecom_webhook_url character varying(500),
    email_enabled boolean NOT NULL,
    smtp_host character varying(200),
    smtp_port integer,
    smtp_user character varying(200),
    smtp_password character varying(200),
    smtp_use_tls boolean NOT NULL
);


--
-- Name: COLUMN user_notification_config.enabled_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_notification_config.enabled_channels IS '启用的通知渠道，如 [''feishu'', ''wecom'']，websocket 始终隐式启用';


--
-- Name: user_recovery_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_recovery_code (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    code_hash character varying(128) NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN user_recovery_code.code_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_recovery_code.code_hash IS '恢复码 bcrypt 哈希';


--
-- Name: COLUMN user_recovery_code.used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_recovery_code.used_at IS '使用时间，非空表示已使用';


--
-- Name: user_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_session (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    jti character varying(36) NOT NULL,
    device_name character varying(200),
    device_type character varying(20),
    ip_address character varying(45),
    user_agent character varying(500),
    device_token character varying(36),
    is_revoked boolean NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN user_session.jti; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_session.jti IS 'JWT ID，用于会话撤销';


--
-- Name: COLUMN user_session.device_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_session.device_token IS '设备标识符，前端生成的 UUID，用于分组统计';


--
-- Name: user_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tag (
    user_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: user_totp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_totp (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    secret_encrypted text NOT NULL,
    label character varying(100) NOT NULL,
    is_active boolean NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN user_totp.secret_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_totp.secret_encrypted IS 'AES-256-GCM 加密的 TOTP 密钥';


--
-- Name: COLUMN user_totp.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_totp.label IS '设备/认证器名称';


--
-- Name: COLUMN user_totp.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_totp.is_active IS '是否已完成激活（激活前为待绑定状态）';


--
-- Name: user_webauthn_credential; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_webauthn_credential (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    credential_id character varying(512) NOT NULL,
    public_key text NOT NULL,
    counter integer NOT NULL,
    label character varying(100) NOT NULL,
    transports character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: COLUMN user_webauthn_credential.credential_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_webauthn_credential.credential_id IS 'WebAuthn credential ID (base64url)';


--
-- Name: COLUMN user_webauthn_credential.public_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_webauthn_credential.public_key IS 'WebAuthn 公钥 (base64url)';


--
-- Name: COLUMN user_webauthn_credential.counter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_webauthn_credential.counter IS '签名计数器';


--
-- Name: COLUMN user_webauthn_credential.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_webauthn_credential.label IS '设备名称';


--
-- Name: COLUMN user_webauthn_credential.transports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_webauthn_credential.transports IS '认证器传输方式';


--
-- Name: vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vote (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    options jsonb NOT NULL,
    allow_multiple boolean NOT NULL,
    status public.votestatus NOT NULL,
    deadline timestamp without time zone,
    owner_id uuid NOT NULL,
    visibility character varying(20) NOT NULL,
    restricted_users jsonb,
    restricted_tags jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vote_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vote_record (
    id uuid NOT NULL,
    vote_id uuid NOT NULL,
    user_id uuid NOT NULL,
    selected_options jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: announcement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.announcement (id, title, content, is_pinned, is_published, owner_id, created_at, updated_at) FROM stdin;
eeb16562-e4b3-4f9b-85f9-727c12ff19e5	w d	w d	f	t	8ce8cbab-88d7-417c-933c-69e2131c7058	2026-09-08 11:03:55.461094	2026-09-08 11:03:55.461094
8728352a-571f-407f-bd19-063f80698f70	s d	s d	f	f	8ce8cbab-88d7-417c-933c-69e2131c7058	2026-09-08 11:47:53.806115	2026-09-08 11:47:53.806115
\.


--
-- Data for Name: budget; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget (id, name, category, amount, spent, period, status, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: calendar_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calendar_event (id, title, description, start_time, end_time, all_day, location, repeat, color, owner_id, visibility, restricted_users, reminder_enabled, reminder_minutes, reminded, created_at, updated_at) FROM stdin;
5936044f-56f3-41a7-bd35-d609992f597f	f g	3让	2026-09-01 01:00:00	2026-09-01 02:00:00	f	\N	NONE	var(--color-info)	8ce8cbab-88d7-417c-933c-69e2131c7058	private	\N	f	15	f	2026-09-08 19:43:17.110503	2026-09-08 19:43:17.110503
\.


--
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contact (id, name, company, email, phone, address, contact_type, tags, notes, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: content; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.content (id, title, body, owner_id, visibility, restricted_users, restricted_tags, tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: file_shares; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.file_shares (id, original_name, stored_name, file_path, file_size, mime_type, share_code, password_hash, expires_at, max_downloads, download_count, is_deleted, deleted_at, owner_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: form; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form (id, title, description, fields, is_active, allow_anonymous, owner_id, visibility, restricted_users, restricted_tags, created_at, updated_at) FROM stdin;
45fb7a80-ab5a-403d-a538-867de96915d3	23		[{"key": "field_1", "type": "text", "label": "23", "options": null, "required": false, "placeholder": null}, {"key": "field_2", "type": "text", "label": "23", "options": null, "required": false, "placeholder": null}]	t	f	8ce8cbab-88d7-417c-933c-69e2131c7058	private	null	null	2026-09-09 13:05:39.43658	2026-09-09 13:05:39.43658
\.


--
-- Data for Name: form_response; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_response (id, form_id, respondent_id, data, created_at) FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory (id, name, category, quantity, location, description, status, tags, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: link_relation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.link_relation (id, source_type, source_id, target_type, target_id, created_at) FROM stdin;
\.


--
-- Data for Name: note; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.note (id, title, content, category, tags, is_pinned, parent_id, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification (id, user_id, message, type, read, created_at) FROM stdin;
\.


--
-- Data for Name: project; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project (id, number, title, description, content, status, owner_id, visibility, restricted_users, restricted_tags, member_ids, member_permissions, department, language, is_open_source, priority, project_type, goals, requirements, additional_req, modules, related_projects, dev_process, repo_url, created_at, updated_at, status_log) FROM stdin;
25272ae5-3502-41da-8166-22558226be9b	\N	ew	\N	{}	draft	8ce8cbab-88d7-417c-933c-69e2131c7058	private	null	null	null	null	\N	\N	f	待定	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-28 19:14:41.52268	2026-08-28 19:14:41.52268	[]
b4411bbe-8a8c-43ff-9d16-81f261bffcdb	\N	we	\N	{}	draft	8ce8cbab-88d7-417c-933c-69e2131c7058	public	null	null	["db64d333-523c-45b6-9901-85756bae62d1"]	null	\N	\N	f	待定	\N	\N	\N	\N	\N	["25272ae5-3502-41da-8166-22558226be9b"]	\N	\N	2026-08-30 11:56:58.665406	2026-08-30 13:34:06.94561	[]
\.


--
-- Data for Name: project_change; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_change (id, project_id, number, title, date, category_major, category_minor, category_detail, content, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_event (id, project_id, number, event_type, title, details, operator_id, created_at) FROM stdin;
\.


--
-- Data for Name: project_meeting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_meeting (id, project_id, number, type, started_at, speaker, participants, content, notes, proposal_id, todo_id, created_at, updated_at, title) FROM stdin;
f2ca9b4b-c044-44e5-9812-d36c38dd272f	b4411bbe-8a8c-43ff-9d16-81f261bffcdb	MTG-B4411BBE-001	会议纪要	2026-09-08 11:00:35.34+08	\N	[]	we	[]	\N	\N	2026-09-08 11:00:39.689225+08	2026-09-08 11:00:39.689225+08	\N
\.


--
-- Data for Name: project_member; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_member (id, project_id, user_id, role_title, notes, is_owner, is_active, joined_at, left_at, created_at) FROM stdin;
0cdd4fd4-8e88-477f-84de-8fd1ccc8657e	b4411bbe-8a8c-43ff-9d16-81f261bffcdb	db64d333-523c-45b6-9901-85756bae62d1	设计	\N	f	t	2026-08-30 13:34:06.924089+08	\N	2026-08-30 13:34:06.911354+08
\.


--
-- Data for Name: project_proposal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_proposal (id, project_id, number, title, type, priority, description, status, reject_reason, attachment_links, creator_id, assignee_id, created_at, updated_at, meeting_id) FROM stdin;
8d85a01c-7518-4f40-aad0-87efc36b0a57	b4411bbe-8a8c-43ff-9d16-81f261bffcdb	PRP-B4411BBE-001	WEWE	feature	P2	WE	pending	\N	[]	8ce8cbab-88d7-417c-933c-69e2131c7058	\N	2026-08-30 14:24:16.260776+08	2026-08-30 14:24:16.260776+08	\N
8abeab5d-1720-4f52-8614-2ca816c21f02	b4411bbe-8a8c-43ff-9d16-81f261bffcdb	PRP-B4411BBE-002	儿	feature	P2	{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"是我的范围分为发改委发改委全覆盖我访问范围气氛委屈范围气氛请问父亲微风我去恶风我去恶"}]}]}	pending	\N	[]	8ce8cbab-88d7-417c-933c-69e2131c7058	\N	2026-08-31 18:54:37.176428+08	2026-08-31 18:54:37.176428+08	\N
\.


--
-- Data for Name: project_proposal_comment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_proposal_comment (id, proposal_id, creator_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: project_todo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_todo (id, project_id, number, title, description, priority, status, assignee_id, creator_id, proposal_id, due_date, created_at, updated_at, meeting_id) FROM stdin;
81961fb3-b703-48f8-a8bd-247480751f57	b4411bbe-8a8c-43ff-9d16-81f261bffcdb	TOD-B4411BBE-001	w r	we	P2	pending	\N	8ce8cbab-88d7-417c-933c-69e2131c7058	\N	\N	2026-08-31 18:54:59.942007+08	2026-08-31 18:54:59.942007+08	\N
\.


--
-- Data for Name: reminder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reminder (id, title, content, trigger_time, target_users, status, creator_id, visibility, restricted_users, created_at) FROM stdin;
\.


--
-- Data for Name: secret; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.secret (id, name, secret_type, category_id, sub_category, encrypted_data, note, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: secret_category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.secret_category (id, name, description, owner_id, visibility, restricted_users, created_at) FROM stdin;
\.


--
-- Data for Name: servers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.servers (id, name, hostname, purpose, location, ip, os, cpu_cores, ram_capacity, ram_unit, disk_capacity, disk_unit, hardware_specs, model, serial_number, tags, description, notes, status, owner_id, maintainer_ids, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services (id, name, description, system_id, protocol, status, health_check_url, target_type, target_name, port, maintainer_ids, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stream_room; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stream_room (id, name, creator_id, mode, room_type, config, is_open, is_active, pusher_id, last_active_at, created_at) FROM stdin;
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription (id, name, provider, amount, billing_cycle, next_billing, status, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_config (key, value) FROM stdin;
setup_complete	{"complete": true}
custom_config	{"favicon": "", "app_name": "一站式工作台", "display_mode": "both", "logo_expanded": "", "app_short_name": "工", "logo_collapsed": "", "app_description": ""}
site_config	{"debug_mode": true, "maintenance_mode": false}
task_heartbeat	{"last_beat_at": "2026-09-09T18:56:30+08:00"}
\.


--
-- Data for Name: systems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.systems (id, name, description, server_id, parent_system_id, ip, os_type, os_version, cpu_allocated, ram_allocated, disk_allocated, status, environment, tags, notes, maintainer_ids, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tag; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tag (id, name, color, created_at) FROM stdin;
\.


--
-- Data for Name: task; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task (id, title, description, status, priority, due_date, assigned_to, owner_id, tags, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.template (id, name, category, location, schema, version, owner_id, visibility, restricted_users, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topology (id, name, description, category, nodes, edges, owner_id, visibility, restricted_users, restricted_tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."user" (id, username, password_hash, nickname, email, phone, gender, avatar, role, status, created_at, updated_at, preferences) FROM stdin;
db64d333-523c-45b6-9901-85756bae62d1	GalleryNick	$2b$12$PuKdUjzEBz4QhZzn3036jurSzEi98jX1EylYQ/NugPjo2W5puVwn2	徐皓允	\N	\N	\N	\N	MEMBER	ACTIVE	2026-08-30 11:57:21.609764	2026-08-30 11:57:21.609764	{}
8ce8cbab-88d7-417c-933c-69e2131c7058	admin	$2b$12$O81Nhd7FM5lnjicxCUUD7u0jvwuqPR6/0uNd5/TvOb4.wl2Qdg97W	admin	\N	\N	\N	\N	ADMIN	ACTIVE	2026-08-27 19:23:52.903916	2026-08-27 19:23:52.903916	{"page_zoom": "100", "theme_mode": "system"}
\.


--
-- Data for Name: user_notification_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_notification_config (id, user_id, enabled_channels, feishu_webhook_url, wecom_webhook_url, email_enabled, smtp_host, smtp_port, smtp_user, smtp_password, smtp_use_tls) FROM stdin;
\.


--
-- Data for Name: user_recovery_code; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_recovery_code (id, user_id, code_hash, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_session (id, user_id, jti, device_name, device_type, ip_address, user_agent, device_token, is_revoked, last_active_at, created_at) FROM stdin;
f5dd0070-e113-4835-83ec-94f5cc8118dd	8ce8cbab-88d7-417c-933c-69e2131c7058	738f6327-1df2-43ba-b71b-5b223bdd78fc	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-08-27 19:23:58.701622+08	2026-08-27 19:23:58.701622+08
31216c25-20c8-4ec3-86f2-1d015f041ef5	8ce8cbab-88d7-417c-933c-69e2131c7058	8bb5b039-acc0-4d48-b32a-37d17436fdf2	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-08-28 19:10:20.063056+08	2026-08-28 19:10:20.063056+08
b8ca80c1-3619-4ea4-97ee-94914dea23b5	8ce8cbab-88d7-417c-933c-69e2131c7058	19b21e97-ea4d-4205-ab98-9d5c5d13c573	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-08-28 19:11:01.83205+08	2026-08-28 19:11:01.83205+08
b7b9b8e2-3ac5-48e7-a1e8-09359f47bcff	8ce8cbab-88d7-417c-933c-69e2131c7058	c38bdbe1-260a-40b1-9f2c-db79a79752de	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-08-28 19:11:35.765094+08	2026-08-28 19:11:35.765094+08
3cdf45f1-c772-4444-8d66-35e7724987b9	8ce8cbab-88d7-417c-933c-69e2131c7058	11d84e3b-c62b-47d3-a47a-390c01ba9083	curl/8.7.1	desktop	172.18.0.9	curl/8.7.1	\N	f	2026-08-28 19:59:28.540899+08	2026-08-28 19:59:28.540899+08
e530771c-10ee-4e84-b768-a437aa5548c3	8ce8cbab-88d7-417c-933c-69e2131c7058	b4173072-ad5d-453e-924d-70059c29c52d	curl/8.7.1	desktop	172.18.0.9	curl/8.7.1	\N	f	2026-08-28 20:06:01.452159+08	2026-08-28 20:06:01.452159+08
68a2077f-e18e-4931-95c4-3c33b61d0ccb	8ce8cbab-88d7-417c-933c-69e2131c7058	9dcf8b0e-db08-4847-9f59-a8173f9dc228	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-08-31 18:47:17.941597+08	2026-08-31 18:47:17.941597+08
b10bb28a-c947-4c8a-9717-9486e94bec7c	8ce8cbab-88d7-417c-933c-69e2131c7058	4d519d76-6896-4844-86e6-aacfcfaf4da0	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-07 13:38:44.97225+08	2026-09-07 13:38:44.97225+08
fe530151-a781-4223-80bb-16f7641d7893	8ce8cbab-88d7-417c-933c-69e2131c7058	0805cefb-ed91-4e02-9889-7e0e216fa970	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-07 18:28:50.712357+08	2026-09-07 18:28:50.712357+08
1e55001f-1b2b-4b5d-8f22-84fcdcb1328e	8ce8cbab-88d7-417c-933c-69e2131c7058	8d127e95-7fcb-4511-b7f2-d98185089652	curl/8.7.1	desktop	192.168.65.1	curl/8.7.1	\N	f	2026-09-07 20:08:04.13408+08	2026-09-07 20:08:04.13408+08
0e8b7483-bf2c-4342-a993-ab8dcd48894e	8ce8cbab-88d7-417c-933c-69e2131c7058	3bef7c19-fb05-42a1-94ba-ac6bd9a768b6	curl/8.7.1	desktop	192.168.65.1	curl/8.7.1	\N	f	2026-09-07 20:09:10.077384+08	2026-09-07 20:09:10.077384+08
9cf9facd-5606-4619-a7e7-79aa1e086547	8ce8cbab-88d7-417c-933c-69e2131c7058	f6c7834a-7fd7-405e-8f97-1311ab66ee3d	curl/8.7.1	desktop	192.168.65.1	curl/8.7.1	\N	f	2026-09-07 20:13:33.754756+08	2026-09-07 20:13:33.754756+08
32e6c033-87c1-4be2-8078-ce65bb45bae0	8ce8cbab-88d7-417c-933c-69e2131c7058	aef9daa1-c0b6-4b34-9e8b-519b2aeec3fd	curl/8.7.1	desktop	192.168.65.1	curl/8.7.1	\N	f	2026-09-07 20:14:32.213521+08	2026-09-07 20:14:32.213521+08
e09112ab-1393-4bfb-b726-be4c5d0c67d1	8ce8cbab-88d7-417c-933c-69e2131c7058	ca9f33db-3897-4ce2-a397-4144ccc1bbc1	curl/8.7.1	desktop	192.168.65.1	curl/8.7.1	\N	f	2026-09-07 20:15:11.082513+08	2026-09-07 20:15:11.082513+08
1a42dfbf-2496-4b2d-832d-59b530425eda	8ce8cbab-88d7-417c-933c-69e2131c7058	abb48489-97f4-4b43-8f9f-8c469a97f9b1	Python-urllib/3.9	desktop	192.168.65.1	Python-urllib/3.9	\N	f	2026-09-07 20:15:28.322833+08	2026-09-07 20:15:28.322833+08
b55d335e-a1f5-4261-bbc5-abf2c42a1057	8ce8cbab-88d7-417c-933c-69e2131c7058	e99965ca-d4b9-4080-95b1-bca6bedd78ad	Python-urllib/3.9	desktop	192.168.65.1	Python-urllib/3.9	\N	f	2026-09-07 20:20:00.092008+08	2026-09-07 20:20:00.092008+08
7429a24b-a945-490a-87a4-2b55bfe1730f	8ce8cbab-88d7-417c-933c-69e2131c7058	c5ed5815-e0f1-4b9a-bd43-4f6a9373b210	Python-urllib/3.9	desktop	192.168.65.1	Python-urllib/3.9	\N	f	2026-09-08 06:59:36.2945+08	2026-09-08 06:59:36.2945+08
54aab6d0-9d9c-42ed-b26f-c7cc2ee0864f	8ce8cbab-88d7-417c-933c-69e2131c7058	88dcca61-747f-4298-b4b9-a64764c73afb	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 07:34:50.522011+08	2026-09-08 07:34:50.522011+08
c7712192-f64d-4d69-a2eb-dad1200b3e56	8ce8cbab-88d7-417c-933c-69e2131c7058	f9c54958-d7ed-4910-b406-32bb1a3ed19f	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 08:11:29.116864+08	2026-09-08 08:11:29.116864+08
0e8c21f4-7d6a-4f40-b42f-c2de51fdf66f	8ce8cbab-88d7-417c-933c-69e2131c7058	73d9d831-bea8-4124-b487-c4020827fc54	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 09:08:09.690899+08	2026-09-08 09:08:09.690899+08
09f4d814-d2ac-4e13-9e3b-47f390798fc0	8ce8cbab-88d7-417c-933c-69e2131c7058	4bcac896-5465-4661-a2bd-bd67e92d28ca	macOS Chrome	desktop	172.18.0.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 09:16:54.37518+08	2026-09-08 09:16:54.37518+08
634e23a4-fc57-4f61-9153-3f4ae878f3e4	8ce8cbab-88d7-417c-933c-69e2131c7058	13d6a959-0049-431f-b373-95eaac1f327e	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 09:45:35.501647+08	2026-09-08 09:45:35.501647+08
a05924d9-c227-43b3-b14a-21fc4d4468ae	8ce8cbab-88d7-417c-933c-69e2131c7058	68b2747e-6847-43c0-93bb-172f47999354	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 09:52:06.829208+08	2026-09-08 09:52:06.829208+08
e21fa880-7329-429a-a9e4-041eac79ee65	8ce8cbab-88d7-417c-933c-69e2131c7058	6ce539ef-6900-4fad-b773-1e774ba6a72b	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 10:03:04.9447+08	2026-09-08 10:03:04.9447+08
04e5b9a9-65b5-433a-aa70-40c9e98371ba	8ce8cbab-88d7-417c-933c-69e2131c7058	3cd58442-1268-499a-8fed-86816d647e88	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 10:12:14.010866+08	2026-09-08 10:12:14.010866+08
e0b95df1-3eb2-42a9-9f70-a34afe79dc61	8ce8cbab-88d7-417c-933c-69e2131c7058	7a76e55f-4bba-4211-a678-ad7e62933011	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 10:29:13.430514+08	2026-09-08 10:29:13.430514+08
0f82b2d3-9caf-46d8-af3f-2f14c2dead6d	8ce8cbab-88d7-417c-933c-69e2131c7058	09836670-5e82-4abc-9650-a405a3b0a964	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 10:30:15.168441+08	2026-09-08 10:30:15.168441+08
36a6d358-744f-4cf4-bf84-ca4a305a9324	8ce8cbab-88d7-417c-933c-69e2131c7058	b31d213e-03d5-426c-8d31-7e3184d0c5e3	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 10:40:17.314865+08	2026-09-08 10:40:17.314865+08
76c3f6ea-832f-455d-98ad-53fb6481570e	8ce8cbab-88d7-417c-933c-69e2131c7058	6b6b1f2c-66ec-48fb-8f51-36a7ab19297d	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 11:10:24.905986+08	2026-09-08 11:10:24.905986+08
006af0b3-b478-450b-9681-98a25e4b4938	8ce8cbab-88d7-417c-933c-69e2131c7058	d7f5cb57-3d95-4aae-ac95-740a66bcc535	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:19:48.631713+08	2026-09-08 11:19:48.631713+08
5683281f-7fdf-4d2f-96b4-d1675bc48185	8ce8cbab-88d7-417c-933c-69e2131c7058	18826ce3-c631-4f11-93bb-3cee4d1fee83	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:26:04.166285+08	2026-09-08 11:26:04.166285+08
d44c2d7e-aae5-46bf-974d-a3df7b0a52b5	8ce8cbab-88d7-417c-933c-69e2131c7058	41c5ef76-883d-4605-9473-55fd0a7f6387	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:26:35.554186+08	2026-09-08 11:26:35.554186+08
90bf4fca-57fe-497a-b897-c4d4de48def6	8ce8cbab-88d7-417c-933c-69e2131c7058	8fac34cc-9ad8-4a79-8693-fce2ec398ce4	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:27:17.930856+08	2026-09-08 11:27:17.930856+08
6b8dcb30-e2f3-4786-a3ac-6d0d34035715	8ce8cbab-88d7-417c-933c-69e2131c7058	1f900598-9eba-4a93-802c-86856e656aad	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:28:00.418757+08	2026-09-08 11:28:00.418757+08
f3c6adc4-32ab-497c-a7fa-730e7d7b42d3	8ce8cbab-88d7-417c-933c-69e2131c7058	9662abba-6023-428b-b46b-28860c2cc28b	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:56:06.789028+08	2026-09-08 11:56:06.789028+08
ea395579-b553-4267-9b38-af921cfdcde9	8ce8cbab-88d7-417c-933c-69e2131c7058	00562d2f-8f4a-4129-a7e9-4a5ebb2ae5fc	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:56:53.433539+08	2026-09-08 11:56:53.433539+08
1d37d2e5-4365-4ae7-9037-59fc066e2e06	8ce8cbab-88d7-417c-933c-69e2131c7058	afebd589-6035-478f-a065-74858f05fb92	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:59:25.596591+08	2026-09-08 11:59:25.596591+08
5153691a-c44a-4351-be9e-f5fb587b42bf	8ce8cbab-88d7-417c-933c-69e2131c7058	63ca46f3-deb8-4e8f-88e6-d1df9252d79a	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 11:59:40.479656+08	2026-09-08 11:59:40.479656+08
763f458e-b5ae-4427-8a9a-9a3fba714453	8ce8cbab-88d7-417c-933c-69e2131c7058	73703880-61b6-47e6-b7c4-6245660b8952	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 12:00:45.021777+08	2026-09-08 12:00:45.021777+08
61436161-91df-4bd4-9afe-23c4249b3f15	8ce8cbab-88d7-417c-933c-69e2131c7058	171ce210-69c5-4169-9aea-1eb9a0bbe595	curl/8.7.1	desktop	172.18.0.1	curl/8.7.1	\N	f	2026-09-08 12:01:01.700954+08	2026-09-08 12:01:01.700954+08
3c915355-0c00-439f-b997-7ee1db825863	8ce8cbab-88d7-417c-933c-69e2131c7058	d705176d-5bc0-4f19-af29-be125c53bdc8	curl/8.7.1	desktop	172.18.0.9	curl/8.7.1	\N	f	2026-09-08 15:34:12.178777+08	2026-09-08 15:34:12.178777+08
2624431b-6d6e-493b-a3f6-5c24015343f7	8ce8cbab-88d7-417c-933c-69e2131c7058	e8ad5c98-06be-46f5-93cd-f81ed61ece06	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:35:17.128611+08	2026-09-08 15:35:17.128611+08
5cd82651-259b-4826-ae30-2aaadb03de67	8ce8cbab-88d7-417c-933c-69e2131c7058	64ea5d6f-a035-4bc1-9729-7eb45a4a9fef	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:36:23.374812+08	2026-09-08 15:36:23.374812+08
99a8f547-a335-4cb1-8111-d54efcf2fd22	8ce8cbab-88d7-417c-933c-69e2131c7058	22bded67-9105-46a9-9fc8-a90bb4d10015	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:36:56.828385+08	2026-09-08 15:36:56.828385+08
765ca8de-dbc6-4a5f-8204-84934ef68344	8ce8cbab-88d7-417c-933c-69e2131c7058	efab0ec8-c19d-4c0c-bc08-4984ee1cac50	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:37:41.280239+08	2026-09-08 15:37:41.280239+08
1add92e4-ee0e-44d8-a804-f8c8c07c0205	8ce8cbab-88d7-417c-933c-69e2131c7058	c4e05a70-c2ae-43a7-afac-631382992307	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:39:21.43755+08	2026-09-08 15:39:21.43755+08
56739428-1206-42ba-a3c1-324615b09c39	8ce8cbab-88d7-417c-933c-69e2131c7058	2334f218-3a60-44e8-bf24-e2ae61dc3b20	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:51:27.61694+08	2026-09-08 15:51:27.61694+08
9be40535-3dda-46a9-919a-c2535a5cde40	8ce8cbab-88d7-417c-933c-69e2131c7058	1955fd98-3868-4906-b9a2-88e45fe983e4	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:53:35.699562+08	2026-09-08 15:53:35.699562+08
bdc39806-fda7-4deb-9a46-8037735317ba	8ce8cbab-88d7-417c-933c-69e2131c7058	b17397d8-4701-4841-8312-64208245db04	node	desktop	172.18.0.9	node	\N	f	2026-09-08 15:54:22.865867+08	2026-09-08 15:54:22.865867+08
e2171c16-bebe-49c3-81bf-3229cb426a38	8ce8cbab-88d7-417c-933c-69e2131c7058	c6c52f83-5982-44cf-91f3-e84925282854	node	desktop	172.18.0.9	node	\N	f	2026-09-08 16:53:21.914491+08	2026-09-08 16:53:21.914491+08
45a363e7-5339-4516-b16b-e1dca71e0482	8ce8cbab-88d7-417c-933c-69e2131c7058	1bb582bb-9137-46bf-aa7f-dd35aceef8cc	node	desktop	172.18.0.9	node	\N	f	2026-09-08 16:54:00.056279+08	2026-09-08 16:54:00.056279+08
77449605-01da-4c17-98b0-d804d9eff1f3	8ce8cbab-88d7-417c-933c-69e2131c7058	4b93cfb7-8236-4cb6-892e-cbd4bf104502	node	desktop	172.18.0.9	node	\N	f	2026-09-08 17:31:37.078532+08	2026-09-08 17:31:37.078532+08
cd9e7a32-0c51-43ce-a14f-90c88557b9a7	8ce8cbab-88d7-417c-933c-69e2131c7058	4d6a20ab-a0a7-45d2-8a98-0ff07c8dccfa	node	desktop	172.18.0.9	node	\N	f	2026-09-08 17:33:12.192081+08	2026-09-08 17:33:12.192081+08
8ac82c91-75a6-4c80-87c5-803b53981f3e	8ce8cbab-88d7-417c-933c-69e2131c7058	75d80b6b-4e3a-45b8-bc63-c3fffdd5c3b9	node	desktop	172.18.0.9	node	\N	f	2026-09-08 17:51:13.995723+08	2026-09-08 17:51:13.995723+08
b8528d89-9b7e-4959-80ac-2405279da7f7	8ce8cbab-88d7-417c-933c-69e2131c7058	5101e899-709b-4a1a-8de7-26066860a112	node	desktop	172.18.0.9	node	\N	f	2026-09-08 17:59:30.033383+08	2026-09-08 17:59:30.033383+08
5fd5295f-3751-42e7-b39a-e83d9d695a2e	8ce8cbab-88d7-417c-933c-69e2131c7058	75b6faba-516b-4464-a66f-9edc32d7f8c6	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:04:38.060692+08	2026-09-08 18:04:38.060692+08
647d5bc3-032e-41b8-b5f0-92b604f984a3	8ce8cbab-88d7-417c-933c-69e2131c7058	e3f478fd-6090-412a-b781-b8eb5430d531	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:10:16.298348+08	2026-09-08 18:10:16.298348+08
733d5130-a3b2-460a-94ab-22aff68310c5	8ce8cbab-88d7-417c-933c-69e2131c7058	3210122f-2954-4a9a-a52d-b297e75f34a2	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:15:23.965786+08	2026-09-08 18:15:23.965786+08
8d37a098-17aa-452b-a0c5-389a2aa5113a	8ce8cbab-88d7-417c-933c-69e2131c7058	d72b6f82-a250-4f20-bcd1-41da76a97e86	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:27:07.610674+08	2026-09-08 18:27:07.610674+08
221ed4f1-a021-4e9e-9061-a49e1bb571fd	8ce8cbab-88d7-417c-933c-69e2131c7058	b8c396d5-c65d-4acd-9e6e-8965c008104d	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:28:45.06631+08	2026-09-08 18:28:45.06631+08
31315ff8-a1a3-442b-87bf-5082ff45ed3d	8ce8cbab-88d7-417c-933c-69e2131c7058	3e6167c7-54d5-4245-a6ba-5a1b5997c2d2	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:31:28.776576+08	2026-09-08 18:31:28.776576+08
64ba58dd-e540-49af-b433-f0fd4828bf07	8ce8cbab-88d7-417c-933c-69e2131c7058	ab25bb94-dd89-452c-b882-7c12637f874d	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:32:32.303446+08	2026-09-08 18:32:32.303446+08
58366eb6-b5d6-4991-860c-7f45b0a28873	8ce8cbab-88d7-417c-933c-69e2131c7058	5aab5557-467d-4d22-bbf5-d79c9cd17a6a	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:45:00.887706+08	2026-09-08 18:45:00.887706+08
b693c3e4-d368-4333-8b56-e68a4daa938f	8ce8cbab-88d7-417c-933c-69e2131c7058	b1b7246c-e818-43c7-9a4e-186e197c965e	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:49:46.226012+08	2026-09-08 18:49:46.226012+08
3d7f019f-18cf-4474-9305-28a226cc269c	8ce8cbab-88d7-417c-933c-69e2131c7058	75dceb2c-ba2f-43a7-bcc8-4ee95d653a2c	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:51:31.504147+08	2026-09-08 18:51:31.504147+08
5d3711be-0271-4e1d-94aa-23a3112e15d7	8ce8cbab-88d7-417c-933c-69e2131c7058	74df4bf6-ddba-4c60-80fd-1040b1fa9e55	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:52:41.747122+08	2026-09-08 18:52:41.747122+08
13ecce3d-fa8b-498f-87fa-4122fc5247ef	8ce8cbab-88d7-417c-933c-69e2131c7058	183249ca-2455-4f63-b43f-b729545260a9	node	desktop	172.18.0.9	node	\N	f	2026-09-08 18:53:37.335125+08	2026-09-08 18:53:37.335125+08
3f3af355-b8ef-42ad-88e4-e66c34569279	8ce8cbab-88d7-417c-933c-69e2131c7058	cb14ca87-90e7-4850-8ba0-34313fb3110b	node	desktop	172.18.0.9	node	\N	f	2026-09-08 19:00:27.821821+08	2026-09-08 19:00:27.821821+08
da140535-b436-4a71-9ecc-d254e786fcee	8ce8cbab-88d7-417c-933c-69e2131c7058	7938f464-4d3a-456d-a2c9-a3fd1232408d	node	desktop	172.18.0.9	node	\N	f	2026-09-08 19:46:12.71738+08	2026-09-08 19:46:12.71738+08
89beda46-f18f-4916-9cc1-efbb82929fec	8ce8cbab-88d7-417c-933c-69e2131c7058	705f1289-325d-49e2-8b77-2f5eb552cd0f	node	desktop	172.18.0.9	node	\N	f	2026-09-08 19:48:33.947927+08	2026-09-08 19:48:33.947927+08
878d0bde-44a9-4958-92f6-d55e6f0f6ddd	8ce8cbab-88d7-417c-933c-69e2131c7058	557068ed-e908-4f32-868d-c95e34ae76e1	node	desktop	172.18.0.9	node	\N	f	2026-09-08 19:54:07.662942+08	2026-09-08 19:54:07.662942+08
fac392c2-2d2d-4254-b7cc-653177fdb4d8	8ce8cbab-88d7-417c-933c-69e2131c7058	54ab97bb-ee15-40fe-a2e0-fa47f886bc42	node	desktop	172.18.0.9	node	\N	f	2026-09-08 19:59:07.060123+08	2026-09-08 19:59:07.060123+08
67c757e6-cc54-4a3e-9b65-465f20339b51	8ce8cbab-88d7-417c-933c-69e2131c7058	b04a7a84-4b10-4d9d-85b1-7ef7e06ab125	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:06:13.287265+08	2026-09-08 20:06:13.287265+08
cc195e60-09fe-43ab-81d7-f8ff88c5eb7e	8ce8cbab-88d7-417c-933c-69e2131c7058	703a9e5b-23d5-4833-8cb1-b5d0e04513d7	Python-urllib/3.9	desktop	172.18.0.9	Python-urllib/3.9	\N	f	2026-09-08 20:31:37.140906+08	2026-09-08 20:31:37.140906+08
d0f9f75d-9f03-4425-843b-cca4427e86ef	8ce8cbab-88d7-417c-933c-69e2131c7058	0f20f2ee-2fcf-4c4f-960a-5ea2290c0b37	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:32:47.375666+08	2026-09-08 20:32:47.375666+08
0132a44e-ac1f-4bbb-96c5-9995ca98c4cb	8ce8cbab-88d7-417c-933c-69e2131c7058	fb4cc975-bd89-4029-b617-c96b41563539	Python-urllib/3.9	desktop	172.18.0.9	Python-urllib/3.9	\N	f	2026-09-08 20:35:31.154787+08	2026-09-08 20:35:31.154787+08
304d251d-8e4b-4ed4-a094-244b8ca47ff1	8ce8cbab-88d7-417c-933c-69e2131c7058	e2e01af7-ac18-494e-b541-6af635961fcf	Python-urllib/3.9	desktop	172.18.0.9	Python-urllib/3.9	\N	f	2026-09-08 20:37:04.311265+08	2026-09-08 20:37:04.311265+08
9ee73706-6c80-4a65-af09-eae2772164b6	8ce8cbab-88d7-417c-933c-69e2131c7058	1be0fee6-7ee6-44df-b14c-a3f555d1183a	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:42:58.112615+08	2026-09-08 20:42:58.112615+08
78fdf9c3-174b-44b3-9f0e-439434eb4a9b	8ce8cbab-88d7-417c-933c-69e2131c7058	9397d840-a639-4d01-b564-9036e58da261	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:50:06.12505+08	2026-09-08 20:50:06.12505+08
fe73c7b8-47f6-4a13-abea-dae418b6b2d8	8ce8cbab-88d7-417c-933c-69e2131c7058	1afb09de-fd4a-419f-bbd7-24492aa08f5f	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:53:35.14249+08	2026-09-08 20:53:35.14249+08
1b9405bb-088c-40a9-9c77-39d929168f8f	8ce8cbab-88d7-417c-933c-69e2131c7058	c6532750-7621-43b9-acd4-a626aa010ac5	node	desktop	172.18.0.9	node	\N	f	2026-09-08 20:58:16.22155+08	2026-09-08 20:58:16.22155+08
6ada462e-f126-49e7-bf5e-63268c55a7db	8ce8cbab-88d7-417c-933c-69e2131c7058	41996a52-eac1-4ec0-9308-ef4372106876	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:06:27.807013+08	2026-09-08 21:06:27.807013+08
ac2745d1-b9a0-4220-92fb-eeea0f9ba69f	8ce8cbab-88d7-417c-933c-69e2131c7058	fe3ea324-b888-4314-92e8-50b2bace0c4b	Python-urllib/3.9	desktop	172.18.0.9	Python-urllib/3.9	\N	f	2026-09-08 21:07:00.227608+08	2026-09-08 21:07:00.227608+08
969c2c68-d4ff-4ebf-852a-cb211dfc872a	8ce8cbab-88d7-417c-933c-69e2131c7058	bbc193fe-9b19-4201-8f5f-1e0b80c5ebc2	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:08:21.269498+08	2026-09-08 21:08:21.269498+08
5283ea93-7dc1-41c9-80ce-5e57b9190ade	8ce8cbab-88d7-417c-933c-69e2131c7058	097296bc-36dc-41df-b5ca-574891863f56	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:09:55.573516+08	2026-09-08 21:09:55.573516+08
8a34caa5-12c5-4bfb-9ef3-1c0e36e3b5b8	8ce8cbab-88d7-417c-933c-69e2131c7058	7f8a43d4-be2d-4d4a-ba3b-b62d7b2a6279	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:20:06.654126+08	2026-09-08 21:20:06.654126+08
7683915d-f604-40f8-babc-2da39b76a0cb	8ce8cbab-88d7-417c-933c-69e2131c7058	25c510a2-881c-4e8e-9ae1-64198d97f0e0	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:24:06.935135+08	2026-09-08 21:24:06.935135+08
9d2dd6de-7e3e-4fd4-a13c-b14459efaa80	8ce8cbab-88d7-417c-933c-69e2131c7058	b669af45-ec57-4ae8-871a-e48bf8f8a686	node	desktop	172.18.0.9	node	\N	f	2026-09-08 21:57:18.931871+08	2026-09-08 21:57:18.931871+08
1c757ec4-44ab-453e-af51-90565a91348b	8ce8cbab-88d7-417c-933c-69e2131c7058	23683212-cfd7-461d-93aa-db36aa0d3a0d	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:01:27.177616+08	2026-09-08 22:01:27.177616+08
25693d5a-226c-4f83-9232-496261fbb4b5	8ce8cbab-88d7-417c-933c-69e2131c7058	b91ff9bf-a5cf-44ac-af38-d65852a03b5a	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 22:06:56.629076+08	2026-09-08 22:06:56.629076+08
485690bc-2fe3-4df8-861d-ddb609f8c0fc	8ce8cbab-88d7-417c-933c-69e2131c7058	0701b583-0d0a-4537-a8c8-8add8a2859e9	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:07:57.196847+08	2026-09-08 22:07:57.196847+08
93179b2f-9b11-4897-acf4-99f61d0bea46	8ce8cbab-88d7-417c-933c-69e2131c7058	c4d02ee9-9f03-4eba-bb3f-d7054da5a020	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:08:22.841117+08	2026-09-08 22:08:22.841117+08
b2834185-d88b-4849-9345-5e88afcda6a2	8ce8cbab-88d7-417c-933c-69e2131c7058	2510aaca-f053-4625-8099-3267971510a8	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:08:50.763884+08	2026-09-08 22:08:50.763884+08
015a72c2-9d01-4495-adf1-2cd5f2c591e5	8ce8cbab-88d7-417c-933c-69e2131c7058	6dbf9437-2428-4ad6-a701-a2b65f01fc7c	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:13:34.306663+08	2026-09-08 22:13:34.306663+08
94f4fc83-49a1-42b7-a76d-4d76abfb99ae	8ce8cbab-88d7-417c-933c-69e2131c7058	c1007f45-7183-489b-8451-27bb09084604	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	c5baae03-680b-4db4-aee9-715e01e185a0	f	2026-09-08 22:13:59.318669+08	2026-09-08 22:13:59.318669+08
03918ed8-486c-4e4a-ab99-2a9cbcc828fa	8ce8cbab-88d7-417c-933c-69e2131c7058	861b8c42-2454-468c-b58d-09aafc025ef7	macOS Chrome	desktop	172.18.0.9	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	33d7469b-ed66-48c6-b37d-1bc70367a608	f	2026-09-08 22:16:09.926688+08	2026-09-08 22:16:09.926688+08
5fbab232-f4a8-454f-ba83-08c83700b55e	8ce8cbab-88d7-417c-933c-69e2131c7058	841ce3b3-e514-4446-953e-95a20fab5d0e	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:17:47.920961+08	2026-09-08 22:17:47.920961+08
32e5149f-59df-4a77-9aac-da86831327f6	8ce8cbab-88d7-417c-933c-69e2131c7058	eb378d04-d576-4e90-8c17-0695a9b067bc	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:23:20.654831+08	2026-09-08 22:23:20.654831+08
4f45c6ed-f9b0-4d15-b094-dc79da58414f	8ce8cbab-88d7-417c-933c-69e2131c7058	97ae954f-37a6-4a70-9940-44e16803605a	node	desktop	172.18.0.9	node	\N	f	2026-09-08 22:29:48.548615+08	2026-09-08 22:29:48.548615+08
5292d12f-02f1-4da3-8133-950c2ca62757	8ce8cbab-88d7-417c-933c-69e2131c7058	cf788af7-a239-4483-9077-bb0dc78fbe96	node	desktop	172.18.0.9	node	\N	f	2026-09-09 09:41:21.919157+08	2026-09-09 09:41:21.919157+08
dc21bcdf-b46d-48fb-92bc-f54cfc97ba2e	8ce8cbab-88d7-417c-933c-69e2131c7058	71d56931-13be-447b-8703-0ef38bc87b98	node	desktop	172.18.0.9	node	\N	f	2026-09-09 09:50:46.989298+08	2026-09-09 09:50:46.989298+08
b98ed97b-36c4-4b77-a71d-38d5c67522cc	8ce8cbab-88d7-417c-933c-69e2131c7058	8adf3f87-a795-472c-8f5f-800389c37c1e	node	desktop	172.18.0.9	node	\N	f	2026-09-09 09:57:45.669964+08	2026-09-09 09:57:45.669964+08
acc44075-5eeb-4b1c-8865-48058ee05bc6	8ce8cbab-88d7-417c-933c-69e2131c7058	20db8408-c69f-42e2-88a7-6fbb347ab86a	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:04:59.850714+08	2026-09-09 10:04:59.850714+08
28a9ddf6-bf46-4f88-b49d-f3c8c7f97c4a	8ce8cbab-88d7-417c-933c-69e2131c7058	9187c397-bdbc-43db-a863-75c8e6dcf64f	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:09:43.924503+08	2026-09-09 10:09:43.924503+08
2ea0362f-6c35-459a-96d3-371e76560c45	8ce8cbab-88d7-417c-933c-69e2131c7058	2e7b50e6-a7b6-4373-b310-eb419affa47f	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:19:03.231189+08	2026-09-09 10:19:03.231189+08
da288e8e-380d-40fd-8ec3-24322db72869	8ce8cbab-88d7-417c-933c-69e2131c7058	2b41511d-942c-4269-914d-b47aa45cf50c	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:27:47.817837+08	2026-09-09 10:27:47.817837+08
ee414ef0-e184-4dd0-ae21-2592ef8960d7	8ce8cbab-88d7-417c-933c-69e2131c7058	245e448c-db6b-4fb1-b07f-90a34f973bc4	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:31:55.775143+08	2026-09-09 10:31:55.775143+08
bd898b5a-c303-4a4b-b932-aa25eb6c1c64	8ce8cbab-88d7-417c-933c-69e2131c7058	b71d085b-0e06-4d25-9e4f-356916832fd4	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:32:22.984866+08	2026-09-09 10:32:22.984866+08
caf6be45-1af5-4c20-8789-9d52eb649a6d	8ce8cbab-88d7-417c-933c-69e2131c7058	73fba60f-ae7a-4cc4-b21d-9a92e18b21d6	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:35:18.519243+08	2026-09-09 10:35:18.519243+08
a0d8fdb5-98ff-4576-be0b-7a22b836ad69	8ce8cbab-88d7-417c-933c-69e2131c7058	af081dfe-a4ad-4b4c-9f9e-6280d611880c	node	desktop	172.18.0.9	node	\N	f	2026-09-09 10:39:02.556186+08	2026-09-09 10:39:02.556186+08
\.


--
-- Data for Name: user_tag; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_tag (user_id, tag_id) FROM stdin;
\.


--
-- Data for Name: user_totp; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_totp (id, user_id, secret_encrypted, label, is_active, last_used_at, created_at) FROM stdin;
37eeddd6-259e-49cf-b3b3-bc5eda43a602	8ce8cbab-88d7-417c-933c-69e2131c7058	aceb3497bf05c1d6880f60caf563b68e09f8c4ece68532993ca7d7d865202586d8b74ce19120c72f7ac9c4e837f3d2d5037aa6381e007cf8867dad0f52bc5d893b05096af8	认证器	f	\N	2026-09-07 18:31:29.489957+08
7f3d58ba-a40b-49ed-8ed0-9ca106121e37	8ce8cbab-88d7-417c-933c-69e2131c7058	164bd93db260b4dd28530d7917e9a3a98b1e558a7ff9e5b9c3e9c49dd456dc5f4c5ef6102ec35621f7d8456167a0f550dc12c840988f48f0144a2814feba27924d2c964e08	认证器	f	\N	2026-09-07 18:37:45.07284+08
fa865a56-6abf-4e9b-a02a-5e705a4b7932	8ce8cbab-88d7-417c-933c-69e2131c7058	dbf6a743a91716a77764dcdab5c06f92a80281f358892c43443f83b65f9b87fefa33313d8780366a921ea5a1b9d7eb3e2b000780a6350cf5b8a6f08204b16664ce3a8360c3	认证器	f	\N	2026-09-07 18:38:08.462976+08
efa113f3-6333-44a4-be74-641c0f34d5e7	8ce8cbab-88d7-417c-933c-69e2131c7058	eaa997a78967d9a2ee6a143ef8c7512556866b6ee5fefd009f5297fd9760499f462448dfbf0e42d5fabc289e2257cd2948397f4f02584bfffdff61660072a6558572990693	认证器	f	\N	2026-09-07 18:43:07.550391+08
34e79fcb-d0d2-44a4-91c3-6a7618528e62	8ce8cbab-88d7-417c-933c-69e2131c7058	f3fcb7ff56909590d114aa030ef0cf39502c03394a5799e0979805071ac468b9506883c596ea3b7fecc99bbd5ce68720366d3372e18f71a62863d9eb153389ad8d7482f1c3	认证器	f	\N	2026-09-07 18:51:26.643356+08
49c40e61-a4fb-4e0c-9b78-01a3df9a5518	8ce8cbab-88d7-417c-933c-69e2131c7058	f0aad383ebafd5d49e26243f7f38d53366599f1cc8c579aab1958b7a75849f435bff99f2b42ca1b98a25fd5ece4f77c5b3198861b366b93c3a2c876f52ee9475919a80ea8f	认证器	f	\N	2026-09-07 19:19:40.880255+08
\.


--
-- Data for Name: user_webauthn_credential; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_webauthn_credential (id, user_id, credential_id, public_key, counter, label, transports, created_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: vote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vote (id, title, description, options, allow_multiple, status, deadline, owner_id, visibility, restricted_users, restricted_tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vote_record; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vote_record (id, vote_id, user_id, selected_options, created_at) FROM stdin;
\.


--
-- Name: announcement announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_pkey PRIMARY KEY (id);


--
-- Name: budget budget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget
    ADD CONSTRAINT budget_pkey PRIMARY KEY (id);


--
-- Name: calendar_event calendar_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event
    ADD CONSTRAINT calendar_event_pkey PRIMARY KEY (id);


--
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- Name: content content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_pkey PRIMARY KEY (id);


--
-- Name: file_shares file_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_shares
    ADD CONSTRAINT file_shares_pkey PRIMARY KEY (id);


--
-- Name: form form_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form
    ADD CONSTRAINT form_pkey PRIMARY KEY (id);


--
-- Name: form_response form_response_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_response
    ADD CONSTRAINT form_response_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: link_relation link_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_relation
    ADD CONSTRAINT link_relation_pkey PRIMARY KEY (id);


--
-- Name: note note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note
    ADD CONSTRAINT note_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: project_change project_change_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_change
    ADD CONSTRAINT project_change_pkey PRIMARY KEY (id);


--
-- Name: project_event project_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_event
    ADD CONSTRAINT project_event_pkey PRIMARY KEY (id);


--
-- Name: project_meeting project_meeting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_meeting
    ADD CONSTRAINT project_meeting_pkey PRIMARY KEY (id);


--
-- Name: project_member project_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_pkey PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: project_proposal_comment project_proposal_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal_comment
    ADD CONSTRAINT project_proposal_comment_pkey PRIMARY KEY (id);


--
-- Name: project_proposal project_proposal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal
    ADD CONSTRAINT project_proposal_pkey PRIMARY KEY (id);


--
-- Name: project_todo project_todo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_pkey PRIMARY KEY (id);


--
-- Name: reminder reminder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder
    ADD CONSTRAINT reminder_pkey PRIMARY KEY (id);


--
-- Name: secret_category secret_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_category
    ADD CONSTRAINT secret_category_pkey PRIMARY KEY (id);


--
-- Name: secret secret_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret
    ADD CONSTRAINT secret_pkey PRIMARY KEY (id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: stream_room stream_room_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_room
    ADD CONSTRAINT stream_room_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (id);


--
-- Name: tag tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_name_key UNIQUE (name);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: template template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template
    ADD CONSTRAINT template_pkey PRIMARY KEY (id);


--
-- Name: topology topology_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topology
    ADD CONSTRAINT topology_pkey PRIMARY KEY (id);


--
-- Name: project_member uq_project_member_project_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT uq_project_member_project_user UNIQUE (project_id, user_id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user_notification_config user_notification_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_config
    ADD CONSTRAINT user_notification_config_pkey PRIMARY KEY (id);


--
-- Name: user_notification_config user_notification_config_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_config
    ADD CONSTRAINT user_notification_config_user_id_key UNIQUE (user_id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_recovery_code user_recovery_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recovery_code
    ADD CONSTRAINT user_recovery_code_pkey PRIMARY KEY (id);


--
-- Name: user_session user_session_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT user_session_jti_key UNIQUE (jti);


--
-- Name: user_session user_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT user_session_pkey PRIMARY KEY (id);


--
-- Name: user_tag user_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tag
    ADD CONSTRAINT user_tag_pkey PRIMARY KEY (user_id, tag_id);


--
-- Name: user_totp user_totp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_totp
    ADD CONSTRAINT user_totp_pkey PRIMARY KEY (id);


--
-- Name: user_webauthn_credential user_webauthn_credential_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_webauthn_credential
    ADD CONSTRAINT user_webauthn_credential_credential_id_key UNIQUE (credential_id);


--
-- Name: user_webauthn_credential user_webauthn_credential_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_webauthn_credential
    ADD CONSTRAINT user_webauthn_credential_pkey PRIMARY KEY (id);


--
-- Name: vote vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote
    ADD CONSTRAINT vote_pkey PRIMARY KEY (id);


--
-- Name: vote_record vote_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_record
    ADD CONSTRAINT vote_record_pkey PRIMARY KEY (id);


--
-- Name: ix_file_shares_share_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_file_shares_share_code ON public.file_shares USING btree (share_code);


--
-- Name: ix_project_proposal_comment_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_proposal_comment_proposal_id ON public.project_proposal_comment USING btree (proposal_id);


--
-- Name: ix_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_username ON public."user" USING btree (username);


--
-- Name: announcement announcement_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: budget budget_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget
    ADD CONSTRAINT budget_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: calendar_event calendar_event_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event
    ADD CONSTRAINT calendar_event_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: contact contact_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: content content_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: file_shares file_shares_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_shares
    ADD CONSTRAINT file_shares_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: note fk_note_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note
    ADD CONSTRAINT fk_note_parent FOREIGN KEY (parent_id) REFERENCES public.note(id) ON DELETE SET NULL;


--
-- Name: form form_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form
    ADD CONSTRAINT form_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: form_response form_response_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_response
    ADD CONSTRAINT form_response_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form(id);


--
-- Name: form_response form_response_respondent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_response
    ADD CONSTRAINT form_response_respondent_id_fkey FOREIGN KEY (respondent_id) REFERENCES public."user"(id);


--
-- Name: inventory inventory_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: note note_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note
    ADD CONSTRAINT note_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: notification notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: project_change project_change_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_change
    ADD CONSTRAINT project_change_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_event project_event_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_event
    ADD CONSTRAINT project_event_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project_event project_event_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_event
    ADD CONSTRAINT project_event_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_meeting project_meeting_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_meeting
    ADD CONSTRAINT project_meeting_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_meeting project_meeting_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_meeting
    ADD CONSTRAINT project_meeting_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.project_proposal(id) ON DELETE SET NULL;


--
-- Name: project_meeting project_meeting_todo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_meeting
    ADD CONSTRAINT project_meeting_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.project_todo(id) ON DELETE SET NULL;


--
-- Name: project_member project_member_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_member project_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project project_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: project_proposal project_proposal_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal
    ADD CONSTRAINT project_proposal_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: project_proposal_comment project_proposal_comment_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal_comment
    ADD CONSTRAINT project_proposal_comment_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project_proposal_comment project_proposal_comment_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal_comment
    ADD CONSTRAINT project_proposal_comment_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.project_proposal(id) ON DELETE CASCADE;


--
-- Name: project_proposal project_proposal_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal
    ADD CONSTRAINT project_proposal_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project_proposal project_proposal_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal
    ADD CONSTRAINT project_proposal_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.project_meeting(id) ON DELETE SET NULL;


--
-- Name: project_proposal project_proposal_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_proposal
    ADD CONSTRAINT project_proposal_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_todo project_todo_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: project_todo project_todo_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project_todo project_todo_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.project_meeting(id) ON DELETE SET NULL;


--
-- Name: project_todo project_todo_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_todo project_todo_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_todo
    ADD CONSTRAINT project_todo_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.project_proposal(id) ON DELETE SET NULL;


--
-- Name: reminder reminder_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder
    ADD CONSTRAINT reminder_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id);


--
-- Name: secret secret_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret
    ADD CONSTRAINT secret_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.secret_category(id);


--
-- Name: secret_category secret_category_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_category
    ADD CONSTRAINT secret_category_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: secret secret_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret
    ADD CONSTRAINT secret_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: servers servers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: services services_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: stream_room stream_room_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_room
    ADD CONSTRAINT stream_room_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public."user"(id);


--
-- Name: subscription subscription_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: systems systems_parent_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_parent_system_id_fkey FOREIGN KEY (parent_system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: systems systems_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: task task_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public."user"(id);


--
-- Name: task task_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: template template_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template
    ADD CONSTRAINT template_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: topology topology_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topology
    ADD CONSTRAINT topology_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: user_notification_config user_notification_config_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_config
    ADD CONSTRAINT user_notification_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_recovery_code user_recovery_code_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recovery_code
    ADD CONSTRAINT user_recovery_code_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_session user_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT user_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_tag user_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tag
    ADD CONSTRAINT user_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: user_tag user_tag_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tag
    ADD CONSTRAINT user_tag_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: user_totp user_totp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_totp
    ADD CONSTRAINT user_totp_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_webauthn_credential user_webauthn_credential_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_webauthn_credential
    ADD CONSTRAINT user_webauthn_credential_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: vote vote_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote
    ADD CONSTRAINT vote_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public."user"(id);


--
-- Name: vote_record vote_record_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_record
    ADD CONSTRAINT vote_record_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: vote_record vote_record_vote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_record
    ADD CONSTRAINT vote_record_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.vote(id);


--
-- PostgreSQL database dump complete
--

\unrestrict j0cVIRpGaFxHEs0D8fZJZBEbycjMRxrVTbyuxBu3vWg7Pcd8KLCEXLQxuj6QexN

