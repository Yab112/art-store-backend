import {
  PaginatedResponse,
  PaginationInputs,
} from '@/common/dto/pagination.dto';
import { PrismaClient } from '@prisma/client';

export class PrismaGenericRepository<T> {
  private _repository: any;

  constructor(repository: PrismaClient[keyof PrismaClient]) {
    this._repository = repository;
  }

  async filterAndSearchManyAndPaginate(
    filter: Record<string, any>,
    fieldsToSearch: string[],
    pagination: PaginationInputs,
    include?: Record<string, any>,
  ): Promise<PaginatedResponse<T>> {
    const {
      page = 1,
      limit = 10,
      sort = 'id',
      sortOrder = 'asc',
      searchText = '',
    } = pagination;

    const mainQuery: Record<string, any> = { ...filter };
    if (searchText) {
      mainQuery.OR = fieldsToSearch.map((field) => ({
        [field]: { contains: searchText, mode: 'insensitive' },
      }));
    }
    const data = await this._repository.findMany({
      where: mainQuery,
      skip: (page - 1) * +limit,
      take: +limit,
      orderBy: { [sort]: sortOrder },
      include,
    });

    const count = await this._repository.count({ where: mainQuery });

    return {
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      count,
      values: data,
    };
  }
}
