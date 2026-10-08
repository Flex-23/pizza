-- ============================================================================
-- ⚠️  NOT IN USE — this is a **MySQL** dump.
--
-- The database moved to PostgreSQL on Supabase. Nothing here will import into
-- it, and nothing needs to: the schema is applied with `npm run db:push`
-- against DIRECT_URL instead.
--
-- Kept for a move back to MySQL / cPanel. Regenerate it first, after switching
-- prisma/schema.prisma back to `provider = "mysql"`:
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- ============================================================================

-- ============================================================================
-- Pizza Day & Night — full database build script (MySQL / MariaDB)
--
-- Generated from prisma/schema.prisma with:
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--
-- Import it on the server with phpMyAdmin (Import tab) or from a shell:
--   mysql -u root -p < pizza_day_night.sql
--
-- If your host already created the database for you under a different name,
-- delete the CREATE DATABASE / USE lines below and select the database first.
--
-- Contains structure only. No menu content: every category, dish, price and
-- discount is created at runtime through the admin dashboard. Create the first
-- staff account afterwards with `npm run create:admin` pointed at this database.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `pizza_day_night`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pizza_day_night`;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('CUSTOMER', 'ADMIN', 'MASTER') NOT NULL DEFAULT 'CUSTOMER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(60) NULL,
    `street` VARCHAR(180) NOT NULL,
    `postalCode` VARCHAR(12) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `district` VARCHAR(80) NULL,
    `notes` VARCHAR(255) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `addresses_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(120) NOT NULL,
    `nameDe` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(160) NOT NULL,
    `nameDe` VARCHAR(160) NOT NULL,
    `descriptionAr` TEXT NULL,
    `descriptionDe` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 0,
    `discountPrice` DECIMAL(10, 2) NULL,
    `imageUrl` VARCHAR(500) NULL,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `tags` JSON NULL,
    `allergens` JSON NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `menu_items_categoryId_sortOrder_idx`(`categoryId`, `sortOrder`),
    INDEX `menu_items_isAvailable_isFeatured_idx`(`isAvailable`, `isFeatured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_zones` (
    `id` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(12) NOT NULL,
    `areaName` VARCHAR(100) NOT NULL,
    `deliveryFee` DECIMAL(10, 2) NOT NULL,
    `minOrder` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `delivery_zones_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    UNIQUE INDEX `delivery_zones_postalCode_areaName_key`(`postalCode`, `areaName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(24) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `customerName` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(160) NULL,
    `orderType` ENUM('DELIVERY', 'PICKUP') NOT NULL DEFAULT 'DELIVERY',
    `street` VARCHAR(180) NULL,
    `postalCode` VARCHAR(12) NULL,
    `city` VARCHAR(80) NULL,
    `dailySeq` INTEGER NULL,
    `shiftDate` VARCHAR(10) NULL,
    `items` JSON NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `deliveryFee` DECIMAL(10, 2) NOT NULL,
    `discountTotal` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` ENUM('CASH_ON_DELIVERY', 'CARD_ON_DELIVERY', 'ONLINE') NOT NULL,
    `paymentStatus` ENUM('UNPAID', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `printRequestedAt` DATETIME(3) NULL,
    `printedAt` DATETIME(3) NULL,
    `printError` VARCHAR(400) NULL,

    UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
    INDEX `orders_createdAt_idx`(`createdAt`),
    INDEX `orders_shiftDate_idx`(`shiftDate`),
    INDEX `orders_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `orders_printRequestedAt_printedAt_idx`(`printRequestedAt`, `printedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_counters` (
    `shiftDate` VARCHAR(10) NOT NULL,
    `lastSeq` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`shiftDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_daily_archives` (
    `day` VARCHAR(10) NOT NULL,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `isOpen` BOOLEAN NOT NULL DEFAULT true,
    `promoBannerEnabled` BOOLEAN NOT NULL DEFAULT false,
    `promoBannerAr` VARCHAR(255) NULL,
    `promoBannerDe` VARCHAR(255) NULL,
    `heroImages` JSON NULL,
    `minOrderValue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `deliveryFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `receiptWidthMm` INTEGER NOT NULL DEFAULT 58,
    `freeDeliveryFrom` DECIMAL(10, 2) NULL,
    `restaurantNameAr` VARCHAR(160) NOT NULL DEFAULT 'بيتزا داي أند نايت',
    `restaurantNameDe` VARCHAR(160) NOT NULL DEFAULT 'Pizza Day & Night',
    `street` VARCHAR(180) NOT NULL DEFAULT 'Hardtstraße 32',
    `postalCode` VARCHAR(12) NOT NULL DEFAULT '76185',
    `city` VARCHAR(80) NOT NULL DEFAULT 'Karlsruhe',
    `phone` VARCHAR(40) NOT NULL DEFAULT '0721 8601726',
    `phone2` VARCHAR(40) NULL,
    `fax` VARCHAR(40) NULL,
    `email` VARCHAR(160) NULL,
    `facebookUrl` VARCHAR(255) NULL,
    `mapEmbedUrl` VARCHAR(1000) NULL,
    `salesUrl` VARCHAR(500) NULL,
    `openingHours` JSON NULL,
    `termsAr` TEXT NULL,
    `termsDe` TEXT NULL,
    `privacyAr` TEXT NULL,
    `privacyDe` TEXT NULL,
    `allergensAr` TEXT NULL,
    `allergensDe` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
