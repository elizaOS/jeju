import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, Index as Index_, ManyToOne as ManyToOne_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Account} from "./account.model"
import {AgentMetadata} from "./agentMetadata.model"
import {RegistryStake} from "./registryStake.model"
import {TagUpdate} from "./tagUpdate.model"

@Entity_()
export class RegisteredAgent {
    constructor(props?: Partial<RegisteredAgent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_({unique: true})
    @BigIntColumn_({nullable: false})
    agentId!: bigint

    @Index_()
    @ManyToOne_(() => Account, {nullable: true})
    owner!: Account

    @StringColumn_({nullable: true})
    tokenURI!: string | undefined | null

    @StringColumn_({nullable: false})
    name!: string

    @StringColumn_({nullable: true})
    description!: string | undefined | null

    @StringColumn_({array: true, nullable: false})
    tags!: (string)[]

    @StringColumn_({nullable: false})
    stakeToken!: string

    @BigIntColumn_({nullable: false})
    stakeAmount!: bigint

    @BooleanColumn_({nullable: false})
    stakeWithdrawn!: boolean

    @Index_()
    @DateTimeColumn_({nullable: false})
    registeredAt!: Date

    @BigIntColumn_({nullable: false})
    depositedAt!: bigint

    @BigIntColumn_({nullable: true})
    withdrawnAt!: bigint | undefined | null

    @BooleanColumn_({nullable: false})
    active!: boolean

    @StringColumn_({nullable: true})
    a2aEndpoint!: string | undefined | null

    @OneToMany_(() => AgentMetadata, e => e.agent)
    metadataUpdates!: AgentMetadata[]

    @OneToMany_(() => RegistryStake, e => e.agent)
    stakes!: RegistryStake[]

    @OneToMany_(() => TagUpdate, e => e.agent)
    tagUpdates!: TagUpdate[]
}
