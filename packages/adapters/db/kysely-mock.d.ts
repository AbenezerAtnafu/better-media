declare module "kysely" {
  export type Kysely<T> = {
    insertInto<Table extends keyof T>(table: Table): unknown;
    selectFrom<Table extends keyof T>(table: Table | Table[]): unknown;
    updateTable<Table extends keyof T>(table: Table): unknown;
    deleteFrom<Table extends keyof T>(table: Table): unknown;
    transaction(): unknown;
    schema: {
      createTable(name: string): {
        ifNotExists(): CreateTableBuilder;
        execute(): Promise<void>;
      };
    };
    fn: {
      count(column: string): { as: (alias: string) => unknown };
    };
    _brand?: T;
  };

  export type CreateTableBuilder = {
    addColumn(name: string, type: string, cb: (col: ColBuilder) => ColBuilder): CreateTableBuilder;
    execute(): Promise<void>;
  };

  export type ColBuilder = {
    primaryKey(): ColBuilder;
    notNull(): ColBuilder;
    unique(): ColBuilder;
    references(r: string): ColBuilder;
    onDelete(o: string): ColBuilder;
  };

  export type SelectQueryBuilder<DB, TB, O> = { _db?: DB; _tb?: TB; _o?: O };
  export type UpdateQueryBuilder<DB, TB, UT, O> = { _db?: DB; _tb?: TB; _ut?: UT; _o?: O };
  export type DeleteQueryBuilder<DB, TB, O> = { _db?: DB; _tb?: TB; _o?: O };
}
