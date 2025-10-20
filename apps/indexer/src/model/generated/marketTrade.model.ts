import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BooleanColumn as BooleanColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"
import {PredictionMarket} from "./predictionMarket.model"
import {Account} from "./account.model"

@Entity_()
export class MarketTrade {
    constructor(props?: Partial<MarketTrade>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PredictionMarket, {nullable: true})
    market!: PredictionMarket

    @Index_()
    @ManyToOne_(() => Account, {nullable: true})
    trader!: Account

    @BooleanColumn_({nullable: false})
    outcome!: boolean

    @BooleanColumn_({nullable: false})
    isBuy!: boolean

    @BigIntColumn_({nullable: false})
    shares!: bigint

    @BigIntColumn_({nullable: false})
    cost!: bigint

    @BigIntColumn_({nullable: false})
    priceAfter!: bigint

    @Index_()
    @DateTimeColumn_({nullable: false})
    timestamp!: Date
}
