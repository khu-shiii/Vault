-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "event_mappings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "external_customer_id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "consent" JSONB NOT NULL DEFAULT '{}',
    "quiet_hours" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "external_customer_id" TEXT,
    "anonymous_id" TEXT,
    "event_name" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sdk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "interaction_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "action_id" TEXT,
    "status" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "trigger_event_id" TEXT NOT NULL,
    "trigger_event_name" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "halted" BOOLEAN NOT NULL DEFAULT false,
    "plan" JSONB NOT NULL,
    "excluded" JSONB NOT NULL,
    "gates" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "depends_on_step" INTEGER,
    "not_before" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "mock" BOOLEAN NOT NULL DEFAULT true,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customers_org_ext" ON "customers"("organization_id", "external_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_anon_org_anon" ON "anonymous_identities"("organization_id", "anonymous_id");

-- CreateIndex
CREATE INDEX "idx_sdk_events_customer_time" ON "sdk_events"("organization_id", "customer_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_sdk_events_anon" ON "sdk_events"("organization_id", "anonymous_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sdk_events_org_event" ON "sdk_events"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "idx_interactions_customer_time" ON "interaction_events"("organization_id", "customer_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_interactions_org_id" ON "interaction_events"("organization_id", "interaction_id");

-- CreateIndex
CREATE INDEX "idx_decisions_customer" ON "decisions"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_decisions_org_trigger" ON "decisions"("organization_id", "trigger_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "actions_idempotency_key_key" ON "actions"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_actions_decision_step" ON "actions"("decision_id", "step");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_identities" ADD CONSTRAINT "anonymous_identities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdk_events" ADD CONSTRAINT "sdk_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
