module.exports = class Data1760561370372 {
    name = 'Data1760561370372'

    async up(db) {
    }

    async down(db) {
        await db.query(`DROP INDEX "public"."IDX_7a3fa3d4d95b4b6e496ef848d2"`)
        await db.query(`DROP INDEX "public"."IDX_7a3fa3d4d95b4b6e496ef848d2"`)
    }
}
